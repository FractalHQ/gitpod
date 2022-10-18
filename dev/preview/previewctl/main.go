// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"github.com/gitpod-io/gitpod/previewctl/cmd"
	"github.com/sirupsen/logrus"
)

func main() {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{
		DisableColors:   true,
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
	})

	root := cmd.RootCmd(logger)
	if err := root.Execute(); err != nil {
		logger.WithFields(logrus.Fields{"err": err}).Fatal("command failed.")
	}
}
