// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

func TestTopServiceHappyPath(t *testing.T) {
	ctx := context.Background()

	topService := NewTopService()
	topService.Observe(ctx)

	<-topService.ready

	if topService.data == nil {
		t.Errorf("topService data should not be nil")
	}
	if topService.data.Memory.Used == 0 {
		t.Errorf("Used Memory should not be zero")
	}
	if topService.data.Memory.Limit == 0 {
		t.Errorf("Total Memory should not be zero")
	}
	if topService.data.Cpu.Used == 0 {
		t.Errorf("Used CPU should not be zero")
	}
	if topService.data.Cpu.Limit == 0 {
		t.Errorf("Total CPU should not be zero")
	}
}

func TestTopServiceWithUpstreamFailure(t *testing.T) {
	ctx := context.Background()

	var isFirstRun = true

	topService := NewTopService()
	topService.top = func(ctx context.Context) (*api.ResourcesStatusResponse, error) {
		if isFirstRun {
			isFirstRun = false
			return &api.ResourcesStatusResponse{
				Memory: &api.ResourceStatus{
					Used:  1,
					Limit: 10,
				},
				Cpu: &api.ResourceStatus{
					Used:  2,
					Limit: 5,
				},
			}, nil
		} else {
			return nil, xerrors.Errorf("some error occurred with the sock file")
		}
	}
	topService.Observe(ctx)
	<-topService.ready

	if topService.data.Memory.Used != 1 {
		t.Errorf("Used Memory should be 1")
	}
	if topService.data.Memory.Limit != 10 {
		t.Errorf("Total Memory should be 10")
	}
	if topService.data.Cpu.Used != 2 {
		t.Errorf("Used Cpu should be 2")
	}
	if topService.data.Cpu.Limit != 5 {
		t.Errorf("Total Cpu should be 5")
	}

	time.Sleep(2 * time.Second)

	if topService.data.Memory.Used != 1 {
		t.Errorf("Used Memory should be 1")
	}
	if topService.data.Memory.Limit != 10 {
		t.Errorf("Total Memory should be 10")
	}
	if topService.data.Cpu.Used != 2 {
		t.Errorf("Used Cpu should be 2")
	}
	if topService.data.Cpu.Limit != 5 {
		t.Errorf("Total Cpu should be 5")
	}
}
