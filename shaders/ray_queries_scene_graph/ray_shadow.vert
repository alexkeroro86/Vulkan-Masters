#version 460
#extension GL_EXT_ray_query : enable

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;

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

layout(location = 0) out vec4 o_pos;
layout(location = 1) out vec3 o_normal;
layout(location = 2) out vec4 scene_pos;  // scene with respect to BVH coordinates


void main(void)
{
	// We want to be able to perform ray tracing, so don't apply any matrix to scene_pos
	scene_pos = vec4(position, 1);

	o_pos = mesh_data.model * scene_pos;

	// TODO: pass inverse model matrix
	o_normal = mat3(transpose(inverse(mesh_data.model))) * normal;

	gl_Position = global_uniform.view_proj * o_pos;
}
