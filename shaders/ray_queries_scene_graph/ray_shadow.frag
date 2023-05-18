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
	vec4 camera_position;
	vec4 light_position;
}
global_uniform;

layout(push_constant) uniform MeshData
{
	mat4 model;
} mesh_data;

const float RAND[64] = {0.406667, 0.638393, 0.716084, 0.382169, 0.085057, 0.581115, 0.198924, 0.796931, 0.384492, 0.833971, 0.102959, 0.868368, 0.0451188, 0.11126, 0.594166, 0.602356, 0.672335, 0.197668, 0.811019, 0.0251517, 0.366818, 0.781589, 0.0271324, 0.301182, 0.361405, 0.0516313, 0.302812, 0.971661, 0.572212, 0.622672, 0.518818, 0.584786, 0.00461524, 0.703772, 0.527119, 0.0506742, 0.647524, 0.387675, 0.643754, 0.62381, 0.221348, 0.506756, 0.970774, 0.0766738, 0.191826, 0.215034, 0.997108, 0.710535, 0.664146, 0.286801, 0.367709, 0.0489955, 0.54639, 0.949787, 0.866501, 0.212688, 0.258084, 0.963175, 0.608481, 0.324671, 0.640593, 0.0331779, 0.29244, 0.398788};
const float PI = 3.14159265359;


// TODO: sun disk
bool intersects_direction_light(vec3 ray_origin)
{
	const float tmin = 0.01, tmax = 4000;

	rayQueryEXT query;

	rayQueryInitializeEXT(query, topLevelAS, gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, ray_origin, tmin, normalize(global_uniform.light_position.xyz), tmax);
	rayQueryProceedEXT(query);
	if (rayQueryGetIntersectionTypeEXT(query, true) != gl_RayQueryCommittedIntersectionNoneEXT)
	{
		return true;
	}
	return false;
}

vec3 sample_sphere(int i)
{
	float r1 = RAND[uint(mod(i, 64))];
	float r2 = RAND[uint(mod(i + 1, 64))];
	return vec3(cos(2 * PI * r1) * 2 * sqrt(r2 * (1 - r2)), sin(2 * PI * r1) * 2 * sqrt(r2 * (1 - r2)), 1 - 2 * r2);
}

bool intersects_sphere_light(vec3 ray_origin)
{
	// TODO: window size, radius
	float radius = 0.0;
	vec3 light = global_uniform.light_position.xyz + radius * sample_sphere(int(gl_FragCoord.x) + int(gl_FragCoord.y) * 1280);
	vec3 direction = normalize(light - ray_origin);

	const float tmin = 0.01;

	rayQueryEXT query;

	rayQueryInitializeEXT(query, topLevelAS, gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, ray_origin, tmin, direction, 1.0);
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

	// Raster normal
	o_color = vec4(normal * 0.5 + 0.5, 1);

	// Cosine term
	// vec3 light = normalize(global_uniform.light_position.xyz - in_pos.xyz);
	// float lambert = max(dot(normal, light), 0);
	// o_color = vec4(lambert * vec3(1), 1);

	// // Primary ray
	// vec4 camera = global_uniform.camera_position;
	// vec3 direction = normalize(in_pos.xyz - camera.xyz);
	// float dist = intersects_camera(camera.xyz, direction);
	// o_color = vec4(dist * vec3(1), 1);

	const float shadow = intersects_direction_light(in_pos.xyz + normal * 0.001) ? 0.2 : 1;
	o_color = vec4(shadow * vec3(1), 1);

	// vec3 ray_origin = in_pos.xyz + normal * 0.01;
	// float shadow = intersects_sphere_light(ray_origin) ? 0.2 : 1.0;
	// o_color = vec4(shadow * vec3(1), 1);
}
