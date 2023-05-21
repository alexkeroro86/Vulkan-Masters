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
	vec4 frame;
}
global_uniform;

// http://momentsingraphics.de/BlueNoise.html
layout(set = 0, binding = 2) uniform sampler2D texture_sampler;

layout(push_constant) uniform MeshData
{
	mat4 model;
} mesh_data;

const float PI = 3.14159265359;

const float GOLDEN_RATIO = 0.61803398875f;

// Blue noise
const vec2 BlueNoiseInDisk[64] = vec2[64](
    vec2(0.478712,0.875764),
    vec2(-0.337956,-0.793959),
    vec2(-0.955259,-0.028164),
    vec2(0.864527,0.325689),
    vec2(0.209342,-0.395657),
    vec2(-0.106779,0.672585),
    vec2(0.156213,0.235113),
    vec2(-0.413644,-0.082856),
    vec2(-0.415667,0.323909),
    vec2(0.141896,-0.939980),
    vec2(0.954932,-0.182516),
    vec2(-0.766184,0.410799),
    vec2(-0.434912,-0.458845),
    vec2(0.415242,-0.078724),
    vec2(0.728335,-0.491777),
    vec2(-0.058086,-0.066401),
    vec2(0.202990,0.686837),
    vec2(-0.808362,-0.556402),
    vec2(0.507386,-0.640839),
    vec2(-0.723494,-0.229240),
    vec2(0.489740,0.317826),
    vec2(-0.622663,0.765301),
    vec2(-0.010640,0.929347),
    vec2(0.663146,0.647618),
    vec2(-0.096674,-0.413835),
    vec2(0.525945,-0.321063),
    vec2(-0.122533,0.366019),
    vec2(0.195235,-0.687983),
    vec2(-0.563203,0.098748),
    vec2(0.418563,0.561335),
    vec2(-0.378595,0.800367),
    vec2(0.826922,0.001024),
    vec2(-0.085372,-0.766651),
    vec2(-0.921920,0.183673),
    vec2(-0.590008,-0.721799),
    vec2(0.167751,-0.164393),
    vec2(0.032961,-0.562530),
    vec2(0.632900,-0.107059),
    vec2(-0.464080,0.569669),
    vec2(-0.173676,-0.958758),
    vec2(-0.242648,-0.234303),
    vec2(-0.275362,0.157163),
    vec2(0.382295,-0.795131),
    vec2(0.562955,0.115562),
    vec2(0.190586,0.470121),
    vec2(0.770764,-0.297576),
    vec2(0.237281,0.931050),
    vec2(-0.666642,-0.455871),
    vec2(-0.905649,-0.298379),
    vec2(0.339520,0.157829),
    vec2(0.701438,-0.704100),
    vec2(-0.062758,0.160346),
    vec2(-0.220674,0.957141),
    vec2(0.642692,0.432706),
    vec2(-0.773390,-0.015272),
    vec2(-0.671467,0.246880),
    vec2(0.158051,0.062859),
    vec2(0.806009,0.527232),
    vec2(-0.057620,-0.247071),
    vec2(0.333436,-0.516710),
    vec2(-0.550658,-0.315773),
    vec2(-0.652078,0.589846),
    vec2(0.008818,0.530556),
    vec2(-0.210004,0.519896) 
);


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
	vec2 disk_point;
	if (global_uniform.frame.w == 0) {
		vec2 rng = hash23(vec3(gl_FragCoord.xy, global_uniform.frame.z));
		float point_radius = 0.01 * global_uniform.light_position.w * sqrt(rng.x);
		float point_angle = rng.y * 2 * PI;
		disk_point = vec2(point_radius * cos(point_angle), point_radius * sin(point_angle));
	}
	else if (global_uniform.frame.w == 1) {
		// disk_point = 0.01 * global_uniform.light_position.w * BlueNoiseInDisk[int(mod(global_uniform.frame.z, 64))];
        disk_point = 0.01 * global_uniform.light_position.w * BlueNoiseInDisk[0];
	}
    else if (global_uniform.frame.w == 2) {
        float blue_noise = texture(texture_sampler, gl_FragCoord.xy / 64.0f).r;
        float theta = blue_noise * 2.0f * PI;
        float cos_theta = cos(theta);
        float sin_theta = sin(theta);

        // vec2 sample_pos = BlueNoiseInDisk[int(mod(global_uniform.frame.z, 64))];
        vec2 sample_pos = BlueNoiseInDisk[0];

        // 2D rotation
        disk_point.x = sample_pos.x * cos_theta - sample_pos.y * sin_theta;
        disk_point.y = sample_pos.x * sin_theta + sample_pos.y * cos_theta;

        disk_point *= 0.01f * global_uniform.light_position.w;
    }
    else {
        float blue_noise = texture(texture_sampler, gl_FragCoord.xy / 1024.0f).r;
        blue_noise = fract(blue_noise + GOLDEN_RATIO * global_uniform.frame.z);
        float theta = blue_noise * 2.0f * PI;
        float cos_theta = cos(theta);
        float sin_theta = sin(theta);

        // vec2 sample_pos = BlueNoiseInDisk[int(mod(global_uniform.frame.z, 64))];
        vec2 sample_pos = BlueNoiseInDisk[0];

        // 2D rotation
        disk_point.x = sample_pos.x * cos_theta - sample_pos.y * sin_theta;
        disk_point.y = sample_pos.x * sin_theta + sample_pos.y * cos_theta;

        disk_point *= 0.01f * global_uniform.light_position.w;
    }

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
