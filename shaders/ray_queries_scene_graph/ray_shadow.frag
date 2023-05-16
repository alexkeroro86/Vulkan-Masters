#version 460
#extension GL_EXT_ray_query : enable

/* Copyright (c) 2021-2022 Holochip Corporation
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

layout(location = 0) in vec4 in_pos;
layout(location = 1) in vec3 in_normal;
layout(location = 2) in vec4 in_scene_pos;

layout(location = 0) out vec4 o_color;

layout(set = 0, binding = 0) uniform accelerationStructureEXT topLevelAS;

layout(set = 0, binding = 1) uniform GlobalUniform
{
	mat4 view_proj;
	mat4 model;
	vec4 camera_position;
	vec4 light_position;
}
global_uniform;


/**
Apply ray tracing to determine whether the point intersects light
*/
bool intersects_light(vec3 light_origin, vec3 pos)
{
	const float tmin = 0.01;
	const vec3  direction = light_origin - pos;

	rayQueryEXT query;

	rayQueryInitializeEXT(query, topLevelAS, gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, pos, tmin, direction.xyz, 1.0);
	rayQueryProceedEXT(query);
	if (rayQueryGetIntersectionTypeEXT(query, true) != gl_RayQueryCommittedIntersectionNoneEXT)
	{
		return true;
	}
	return false;
}

float intersects_camera(vec3 camera_position, vec3 direction)
{
	const float tmin = 0.01, tmax = 5000;

	rayQueryEXT query;
	rayQueryInitializeEXT(query, topLevelAS, gl_RayFlagsOpaqueEXT, 0xFF, camera_position, tmin, direction, tmax);
	rayQueryProceedEXT(query);
	if (rayQueryGetIntersectionTypeEXT(query, true) != gl_RayQueryCommittedIntersectionNoneEXT)
	{
		return rayQueryGetIntersectionTEXT(query, true) / tmax;
	}
	return 0;
}

void main(void)
{
	vec3 normal = normalize(in_normal);
	o_color = vec4(normal * 0.5 + 0.5, 1);

	// vec3 light = normalize(global_uniform.light_position.xyz - in_pos.xyz);
	// float lambert = max(dot(normal, light), 0);
	// o_color = vec4(lambert * vec3(1), 1);

	//const float lighting = intersects_light(global_uniform.light_position, in_pos.xyz) ? 0.2 : 1;

	// vec3 dist = global_uniform.camera_position.xyz - in_pos.xyz;
	// o_color = vec4(sqrt(dot(dist, dist)) / 5000 * vec3(1), 1);

	vec4 camera = global_uniform.camera_position;
	vec3 direction = normalize(in_pos.xyz - camera.xyz);
	float dist = intersects_camera(camera.xyz, direction);
	o_color = vec4(dist * vec3(1), 1);
}
