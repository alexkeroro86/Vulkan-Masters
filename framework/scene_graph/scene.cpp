/* Copyright (c) 2018-2023, Arm Limited and Contributors
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

#include "scene.h"

#include <queue>

#include "component.h"
#include "components/sub_mesh.h"
#include "node.h"

#ifdef ENABLE_RAYTRACING_SCENE_GRAPH
#include <core/device.h>
#endif

namespace vkb
{
namespace sg
{
Scene::Scene(const std::string &name) :
    name{name}
{}

void Scene::set_name(const std::string &new_name)
{
	name = new_name;
}

const std::string &Scene::get_name() const
{
	return name;
}

void Scene::set_nodes(std::vector<std::unique_ptr<Node>> &&n)
{
	assert(nodes.empty() && "Scene nodes were already set");
	nodes = std::move(n);
}

void Scene::add_node(std::unique_ptr<Node> &&n)
{
	nodes.emplace_back(std::move(n));
}

void Scene::add_child(Node &child)
{
	root->add_child(child);
}

std::unique_ptr<Component> Scene::get_model(uint32_t index)
{
	auto meshes = std::move(components.at(typeid(SubMesh)));

	assert(index < meshes.size());
	return std::move(meshes[index]);
}

void Scene::add_component(std::unique_ptr<Component> &&component, Node &node)
{
	node.set_component(*component);

	if (component)
	{
		components[component->get_type()].push_back(std::move(component));
	}
}

void Scene::add_component(std::unique_ptr<Component> &&component)
{
	if (component)
	{
		components[component->get_type()].push_back(std::move(component));
	}
}

void Scene::set_components(const std::type_index &type_info, std::vector<std::unique_ptr<Component>> &&new_components)
{
	components[type_info] = std::move(new_components);
}

const std::vector<std::unique_ptr<Component>> &Scene::get_components(const std::type_index &type_info) const
{
	return components.at(type_info);
}

bool Scene::has_component(const std::type_index &type_info) const
{
	auto component = components.find(type_info);
	return (component != components.end() && !component->second.empty());
}

Node *Scene::find_node(const std::string &node_name)
{
	for (auto root_node : root->get_children())
	{
		std::queue<sg::Node *> traverse_nodes{};
		traverse_nodes.push(root_node);

		while (!traverse_nodes.empty())
		{
			auto node = traverse_nodes.front();
			traverse_nodes.pop();

			if (node->get_name() == node_name)
			{
				return node;
			}

			for (auto child_node : node->get_children())
			{
				traverse_nodes.push(child_node);
			}
		}
	}

	return nullptr;
}

void Scene::set_root_node(Node &node)
{
	root = &node;
}

Node &Scene::get_root_node()
{
	return *root;
}

#ifdef ENABLE_RAYTRACING_SCENE_GRAPH
void Scene::build_acceleration_structure(vkb::Device const &device)
{
	// TODO: auto-batch
	// TODO: AS stats counter
	
	// Set up a single transformation matrix that can be used to transform the whole geometry
	VkTransformMatrixKHR transform_matrix = {
	    1.0f, 0.0f, 0.0f, 0.0f,
	    0.0f, 1.0f, 0.0f, 0.0f,
	    0.0f, 0.0f, 1.0f, 0.0f};
	std::unique_ptr<vkb::core::Buffer> transform_matrix_buffer = std::make_unique<core::Buffer>(device, sizeof(transform_matrix), VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR | VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT, VMA_MEMORY_USAGE_CPU_TO_GPU);
	transform_matrix_buffer->update(&transform_matrix, sizeof(transform_matrix));

	// Prepare a single BLAS per SubMesh
	for (auto& submesh : get_components<SubMesh>())
	{
		sg::VertexAttribute attrib;
		const auto & vertex_buffer_iter = submesh->vertex_buffers.find("position");
		if (!(submesh->get_attribute("position", attrib) && vertex_buffer_iter != submesh->vertex_buffers.end()))
		{
			continue;
		}

		auto bottom_level_acceleration_structure = std::make_unique<vkb::core::AccelerationStructure>(const_cast<vkb::Device &>(device), VK_ACCELERATION_STRUCTURE_TYPE_BOTTOM_LEVEL_KHR);
		if (submesh->vertex_indices >= 0)
		{
			bottom_level_acceleration_structure->add_triangle_geometry(
			    std::unique_ptr<core::Buffer>(nullptr),
			    submesh->index_buffer,
			    transform_matrix_buffer,
			    submesh->vertex_indices / 3,
			    submesh->vertices_count,
			    attrib.stride,
			    0, attrib.format, submesh->index_type, VK_GEOMETRY_OPAQUE_BIT_KHR,
			    vertex_buffer_iter->second.get_device_address());
		}
		else
		{
			bottom_level_acceleration_structure->add_triangle_geometry(
			    std::unique_ptr<core::Buffer>(nullptr),
			    std::unique_ptr<core::Buffer>(nullptr),
			    transform_matrix_buffer,
			    submesh->vertices_count / 3,
			    submesh->vertices_count,
			    attrib.stride,
			    0, attrib.format, VK_INDEX_TYPE_NONE_KHR, VK_GEOMETRY_OPAQUE_BIT_KHR,
			    vertex_buffer_iter->second.get_device_address());
		}

		bottom_level_acceleration_structures.push_back(std::move(bottom_level_acceleration_structure));
	}

	// Prepare a single instance per BLAS
	top_level_acceleration_structure = std::make_unique<vkb::core::AccelerationStructure>(const_cast<vkb::Device &>(device), VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR);
	size_t instances_count = bottom_level_acceleration_structures.size();
	std::vector<VkAccelerationStructureInstanceKHR> acceleration_structure_instances;
	acceleration_structure_instances.resize(instances_count);
	for (size_t i = 0; i < instances_count; ++i)
	{
		bottom_level_acceleration_structures[i]->build(device.get_suitable_graphics_queue().get_handle(), VK_BUILD_ACCELERATION_STRUCTURE_PREFER_FAST_TRACE_BIT_KHR, VK_BUILD_ACCELERATION_STRUCTURE_MODE_BUILD_KHR);
		LOGI("Built BLAS");

		acceleration_structure_instances[i].transform                              = transform_matrix;
		acceleration_structure_instances[i].instanceCustomIndex                    = 0;
		acceleration_structure_instances[i].mask                                   = 0xFF;
		acceleration_structure_instances[i].instanceShaderBindingTableRecordOffset = 0;
		acceleration_structure_instances[i].flags                                  = VK_GEOMETRY_INSTANCE_TRIANGLE_FACING_CULL_DISABLE_BIT_KHR;
		acceleration_structure_instances[i].accelerationStructureReference         = bottom_level_acceleration_structures[i]->get_device_address();
	}

	std::unique_ptr<vkb::core::Buffer> instances_buffer = std::make_unique<vkb::core::Buffer>(device,
	                                                                                          sizeof(VkAccelerationStructureInstanceKHR) * instances_count,
	                                                                                          VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR | VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
	                                                                                          VMA_MEMORY_USAGE_CPU_TO_GPU);
	instances_buffer->update(acceleration_structure_instances.data(), sizeof(VkAccelerationStructureInstanceKHR) * instances_count);
	top_level_acceleration_structure->add_instance_geometry(instances_buffer, static_cast<uint32_t>(instances_count));

	top_level_acceleration_structure->build(device.get_suitable_graphics_queue().get_handle(), VK_BUILD_ACCELERATION_STRUCTURE_PREFER_FAST_TRACE_BIT_KHR, VK_BUILD_ACCELERATION_STRUCTURE_MODE_BUILD_KHR);
	LOGI("Built TLAS");
}

std::unique_ptr<vkb::core::AccelerationStructure>& Scene::get_acceleration_structure()
{
	return top_level_acceleration_structure;
}

#endif
}        // namespace sg
}        // namespace vkb