/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-web v0.2.1 with parameter "target=ts"
// @generated from file gitpod/v1/prebuilds.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
/* @ts-nocheck */

import {GetPrebuildRequest, GetPrebuildResponse, GetRunningPrebuildRequest, GetRunningPrebuildResponse, ListenToPrebuildLogsRequest, ListenToPrebuildLogsResponse, ListenToPrebuildStatusRequest, ListenToPrebuildStatusResponse} from "./prebuilds_pb.js";
import {MethodKind} from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.v1.PrebuildsService
 */
export const PrebuildsService = {
  typeName: "gitpod.v1.PrebuildsService",
  methods: {
    /**
     * GetPrebuild retrieves a single rebuild.
     * Errors:
     *   NOT_FOUND if the prebuild_id does not exist
     *
     * @generated from rpc gitpod.v1.PrebuildsService.GetPrebuild
     */
    getPrebuild: {
      name: "GetPrebuild",
      I: GetPrebuildRequest,
      O: GetPrebuildResponse,
      kind: MethodKind.Unary,
    },
    /**
     * GetRunningPrebuild returns the prebuild ID of a running prebuild,
     * or NOT_FOUND if there is no prebuild running for the content_url.
     *
     * @generated from rpc gitpod.v1.PrebuildsService.GetRunningPrebuild
     */
    getRunningPrebuild: {
      name: "GetRunningPrebuild",
      I: GetRunningPrebuildRequest,
      O: GetRunningPrebuildResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListenToPrebuildStatus streams status updates for a prebuild. If the prebuild is already
     * in the Done phase, only that single status is streamed.
     *
     * @generated from rpc gitpod.v1.PrebuildsService.ListenToPrebuildStatus
     */
    listenToPrebuildStatus: {
      name: "ListenToPrebuildStatus",
      I: ListenToPrebuildStatusRequest,
      O: ListenToPrebuildStatusResponse,
      kind: MethodKind.ServerStreaming,
    },
    /**
     * ListenToPrebuildLogs returns the log output of a prebuild.
     * This does NOT include an image build if one happened.
     *
     * @generated from rpc gitpod.v1.PrebuildsService.ListenToPrebuildLogs
     */
    listenToPrebuildLogs: {
      name: "ListenToPrebuildLogs",
      I: ListenToPrebuildLogsRequest,
      O: ListenToPrebuildLogsResponse,
      kind: MethodKind.ServerStreaming,
    },
  }
} as const;
