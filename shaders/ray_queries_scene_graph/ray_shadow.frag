#version 460
#extension GL_EXT_ray_query : enable

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
	vec4 frame_info;
}
global_uniform;

layout(push_constant) uniform MeshData
{
	mat4 model;
} mesh_data;

const float PI = 3.14159265359;


// White noise
// https://www.shadertoy.com/view/4djSRW
vec2 hash23(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);
}

// Spherical directional light
// https://blog.demofox.org/2020/05/16/using-blue-noise-for-raytraced-soft-shadows/
bool intersects_directional_light(vec3 ray_origin, inout vec3 direction)
{
	// Shadow ray direction
	vec2 rng = hash23(vec3(gl_FragCoord.xy, global_uniform.frame_info.x));
	float point_radius = 0.01 * global_uniform.light_position.w * sqrt(rng.x);
	float point_angle = rng.y * 2 * PI;
	vec2 disk_point = vec2(point_radius * cos(point_angle), point_radius * sin(point_angle));

	vec3 light = normalize(global_uniform.light_position.xyz);
	vec3 a;
	if (abs(light.x) > 0.9) {
		a = vec3(0, 1, 0);
	}
	else {
		a = vec3(1, 0, 0);
	}
	vec3 light_tangent = normalize(cross(a, light));
	vec3 light_bitangent = normalize(cross(light_tangent, light));
	direction = normalize(light + disk_point.x * light_tangent + disk_point.y * light_bitangent);

	// Trace ray inline
	const float tmin = 0.01, tmax = 4000;

	rayQueryEXT query;

	rayQueryInitializeEXT(query, topLevelAS, gl_RayFlagsTerminateOnFirstHitEXT, 0xFF, ray_origin, tmin, direction, tmax);
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

	vec3 light;
	const float shadow = intersects_directional_light(in_pos.xyz + normal * 0.001, light) ? 0.2 : 1;
	const float lambert = max(dot(light, normal), 0);
	o_color = vec4(lambert * shadow * vec3(1), 1);

	// vec3 ray_origin = in_pos.xyz + normal * 0.01;
	// float shadow = intersects_sphere_light(ray_origin) ? 0.2 : 1.0;
	// o_color = vec4(shadow * vec3(1), 1);
}
