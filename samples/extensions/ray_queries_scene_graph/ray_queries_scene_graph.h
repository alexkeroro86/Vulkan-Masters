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

#include "api_vulkan_sample.h"

namespace vkb
{
namespace sg
{
class Scene;
class Node;
class Mesh;
class SubMesh;
class Camera;
}        // namespace sg
}        // namespace vkb

class RayQueriesSceneGraph : public ApiVulkanSample
{
  public:
	RayQueriesSceneGraph();
	~RayQueriesSceneGraph() override;
	void request_gpu_features(vkb::PhysicalDevice &gpu) override;
	void render(float delta_time) override;
	bool prepare(vkb::Platform &platform) override;
	virtual void on_update_ui_overlay(vkb::Drawer &drawer) override;
	virtual void input_event(const vkb::InputEvent &input_event) override;

  private:
	struct GlobalUniform
	{
		glm::mat4x4 view_proj;
		glm::vec4 camera_position;
		glm::vec4   light_position{0, 1, 0, 0};
		glm::vec4   frame_info{0, 0, 0, 0};
	} global_uniform;

	std::chrono::high_resolution_clock::time_point start_time{std::chrono::high_resolution_clock::now()};

	// Buffers
	std::unique_ptr<vkb::core::Buffer> uniform_buffer{nullptr};

	// Ray tracing structures
	VkPhysicalDeviceAccelerationStructureFeaturesKHR  acceleration_structure_features{};
	vkb::sg::Node* camera_node;

	VkPipeline            pipeline{VK_NULL_HANDLE};
	VkPipelineLayout      pipeline_layout{VK_NULL_HANDLE};
	VkDescriptorSet       descriptor_set{VK_NULL_HANDLE};
	VkDescriptorSetLayout descriptor_set_layout{VK_NULL_HANDLE};

	void build_command_buffers() override;
	void create_uniforms();
	void create_descriptor_pool();
	void create_descriptor_sets();
	void prepare_pipelines();
	void update_uniform_buffers();
	void draw();
};

std::unique_ptr<vkb::VulkanSample> create_ray_queries_scene_graph();
