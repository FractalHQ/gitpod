// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package incluster

import (
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.MySQL(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		affinity, err := helm.AffinityYaml(cluster.AffinityLabelMeta)
		if err != nil {
			return nil, err
		}

		primaryAffinityTemplate, err := helm.KeyFileValue("mysql.primary.affinity", affinity)
		if err != nil {
			return nil, err
		}

		imageRegistry := common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)

		extraEnvVars := map[string]string{}
		// We switched to specific tags because we got subtle broken versions with just specifying major versions
		mysqlBitnamiImageTag := "5.7.34-debian-10-r55"
		if cfg.Config.Database.InClusterMysSQL_8_0 {
			mysqlBitnamiImageTag = "8.0.33-debian-11-r24"
			extraEnvVars["MYSQL_AUTHENTICATION_PLUGIN"] = "mysql_native_password"
		}

		return &common.HelmConfig{
			Enabled: true,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("mysql.image.tag", mysqlBitnamiImageTag),
					helm.KeyValue("mysql.auth.existingSecret", SQLPasswordName),
					helm.KeyValue("mysql.auth.database", Database),
					helm.KeyValue("mysql.auth.username", Username),
					helm.KeyValue("mysql.initdbScriptsConfigMap", SQLInitScripts),
					helm.KeyValue("mysql.serviceAccount.name", Component),
					helm.ImagePullSecrets("mysql.image.pullSecrets", cfg),
					helm.KeyValue("mysql.image.registry", imageRegistry),
					helm.ImagePullSecrets("mysql.metrics.image.pullSecrets", cfg),
					helm.KeyValue("mysql.metrics.image.registry", imageRegistry),
					helm.ImagePullSecrets("mysql.volumePermissions.image.pullSecrets", cfg),
					helm.KeyValue("mysql.volumePermissions.image.pullPolicy", "IfNotPresent"),
					helm.KeyValue("mysql.volumePermissions.image.registry", imageRegistry),
					helm.KeyValueArray("mysql.primary.extraEnvVars", extraEnvVars),

					// improve start time
					helm.KeyValue("mysql.primary.startupProbe.enabled", "false"),
					helm.KeyValue("mysql.primary.livenessProbe.initialDelaySeconds", "30"),
				},
				// This is too complex to be sent as a string
				FileValues: []string{
					primaryAffinityTemplate,
				},
			},
		}, nil
	}),
)
