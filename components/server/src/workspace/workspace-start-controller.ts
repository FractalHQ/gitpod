/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Job } from "../jobs/runner";
import { Config } from "../config";
import { Redis } from "ioredis";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Disposable, DisposableCollection, Queue, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";

const REDIS_CONTROLLER_ID_PREFIX = "workspace-start-controller-id";
const redisControllerIdKey = (id: string) => `${REDIS_CONTROLLER_ID_PREFIX}:${id}`;

/**
 * This class is responsible for making sure that workspace instances are started, even in the face of unexpected container shutdown.
 *
 * To do so, it implements a distributed controller:
 *  - Every X seconds, _all_ server instances control the workspace instances they are responsible for.
 *  - Every Y seconds, _one_ server instance checks if there are workspace instances without a controller (decided by a keepalive mechanism
 *    using redis) and assumes controler over those as well.
 */
@injectable()
export class WorkspaceStartController implements Job {
    private readonly id: WorkspaceStartControllerId;

    // Used for sequencing doControlStartingWorkspace()
    private readonly queue = new Queue();
    private readonly disposable = new DisposableCollection();

    public readonly name = "workspace-start-controller";
    // How often we check for uncontrolled instances (+ once on startup)
    public readonly frequencyMs = 60 * 1000;

    // How often we check "our" instances
    private readonly controllerFrequencyMs = 10 * 1000;
    private get redisExpiryTime() {
        return (this.controllerFrequencyMs / 1000) * 1.5; // After this period without update we consider a controller dead
    }

    constructor(
        @inject(Redis) private readonly redis: Redis,
        @inject(Config) private readonly config: Config,
        @inject(WorkspaceDB) private readonly workspaceDb: WorkspaceDB,
    ) {
        this.id = WorkspaceStartControllerId.create(this.config);
    }

    public start(): Disposable {
        this.disposable.push(repeat(() => this.controlAllOurStartingWorkspaces(), this.controllerFrequencyMs));
        // We rely on the JobRunner to call run() on startup once immediately.
        return Disposable.create(() => this.disposable.dispose());
    }

    /**
     * This is the loop checking regularly (and on start) for uncontrolled instances, and claiming ownership of those.
     */
    public async run(): Promise<void> {
        const controllerId = this.getControllerId();

        const activeControllerIds = (await this.listAllActiveControllerIds()).filter((idStr) => {
            const id = WorkspaceStartControllerId.fromString(idStr);
            if (!id) {
                log.warn("cannot parse controller id", { idStr });
                return false;
            }
            if (
                id.host === this.id.host &&
                id.version === this.id.version &&
                id.initializationTime < this.id.initializationTime
            ) {
                // We are the same pod as the other one, but we are newer.
                // We take over, by surpressing this entry
                return false;
            }
        });

        const instances = await this.workspaceDb.findInstancesByPhase("preparing", "building");
        for (const instance of instances) {
            if (instance.controllerId && activeControllerIds.includes(instance.controllerId)) {
                continue;
            }

            // No-one responsible yet/anymore: We take over
            try {
                await this.workspaceDb.updateInstancePartial(instance.id, { controllerId });
                this.doControlStartingWorkspace(instance, true).catch((err) =>
                    log.error({ instanceId: instance.id }, "error controlling instance after taking it over", err),
                ); // No need to await. Also, we don't want block the mutex for too long
            } catch (err) {
                log.warn({ instanceId: instance.id, err }, "cannot set instance controller id");
            }
        }
    }

    private async controlAllOurStartingWorkspaces() {
        const controllerId = this.getControllerId();
        // Mark ourselves as active
        await this.redis.setex(redisControllerIdKey(controllerId), this.redisExpiryTime, controllerId);

        const instances = await this.workspaceDb.findInstancesByPhase("preparing", "building");
        for (const instance of instances) {
            if (instance.controllerId !== controllerId) {
                continue; // Not our business
            }

            await this.doControlStartingWorkspace(instance);
        }
    }

    /**
     * The actual controlling part
     */
    private async doControlStartingWorkspace(instance: WorkspaceInstance, restart: boolean = false) {
        return this.queue.enqueue(async () => {
            switch (instance.status.phase) {
                case "preparing":
                    if (restart) {
                        // In this case we assume the instance got persisted to the database, but it's unclear whether:
                        //  1. it's image-build got started (which is idempotent, so we can re-trigger that)
                        //  2. it got issued with a ws-manager (which is not idempotent, so we have to check)
                    }
                    return;

                case "building":
                    // Watch the build, re-emit status, and make sure we start the workspaceInstance with ws-manager afterwards
                    return;

                default:
                    return;
            }
        });
    }

    private async listAllActiveControllerIds(): Promise<string[]> {
        const keys = await new Promise<string[]>((resolve, reject) => {
            const result: string[] = [];
            this.redis
                .scanStream({ match: redisControllerIdKey("*"), count: 20 })
                .on("data", async (keys: string[]) => {
                    result.push(...keys);
                })
                .on("error", reject)
                .on("end", () => {
                    resolve(result);
                });
        });
        const ids = keys.map((k) => k.split(":")[1]);
        return ids;
    }

    public getControllerId(): string {
        return WorkspaceStartControllerId.toString(this.id);
    }
}

/**
 * The properties we are after are:
 *  - unique per controlled restart (kubectl delete pod/rollout restart) (HOST)
 *  - human readable (this.config.version)
 *  - unique per container restart (this.initializationTime)
 * @returns
 */
interface WorkspaceStartControllerId {
    host: string;
    version: string;
    initializationTime: string;
}
namespace WorkspaceStartControllerId {
    export function create(config: Config): WorkspaceStartControllerId {
        return {
            host: process.env.HOST || "unknown",
            version: config.version,
            initializationTime: new Date().toISOString(),
        };
    }
    export function fromString(str: string): WorkspaceStartControllerId | undefined {
        const [host, version, initializationTime] = str.split("_");
        if (!host || !version || !initializationTime) {
            return undefined;
        }
        return { host, version, initializationTime };
    }
    export function toString(id: WorkspaceStartControllerId): string {
        return `wscid_${id.host}_${id.version}_${id.initializationTime}`;
    }
}
