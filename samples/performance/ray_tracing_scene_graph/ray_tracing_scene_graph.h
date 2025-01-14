/* Copyright (c) 2019, Arm Limited and Contributors
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 the "License";
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include "rendering/render_pipeline.h"
#include "scene_graph/components/camera.h"
#include "vulkan_sample.h"

class RayTracingSceneGraph : public vkb::VulkanSample
{
public:
	RayTracingSceneGraph();

	virtual ~RayTracingSceneGraph() = default;

	void request_gpu_features(vkb::PhysicalDevice &gpu) override;

	virtual bool prepare(vkb::Platform &platform) override;

	virtual void update(float delta_time) override;

private:
	
};

std::unique_ptr<vkb::VulkanSample> create_ray_tracing_scene_graph();
