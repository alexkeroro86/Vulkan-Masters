// http://grephicsnerd.blogspot.com/2016/03/incorrect-naming-in-ue4-skylight-source.html
// Example: venice_sunset_1k.hdr
// SH9Color radiance;
// radiance.c[0] = vec3(4.28422, 4.59779, 6.3858);
// radiance.c[1] = vec3(-0.952093, -0.554136, -0.289854);
// radiance.c[2] = vec3(-1.26271, -1.90371, -3.43359);
// radiance.c[3] = vec3(1.55512, 1.14196, 0.939754);
// radiance.c[4] = vec3(-0.206367, -0.125346, -0.0812943);
// radiance.c[5] = vec3(0.0923643, 0.0596815, 0.0342347);
// radiance.c[6] = vec3(-0.0534342, 0.0953432, 0.329027);
// radiance.c[7] = vec3(-0.134532, -0.09952, -0.08308);
// radiance.c[8] = vec3(0.0747469, 0.0308596, 0.000135052);

const float Pi = 3.141592654f;
const float CosineA0 = Pi;
const float CosineA1 = (2.0f * Pi) / 3.0f;
const float CosineA2 = Pi * 0.25f;

struct SH9
{
    float c[9];
};

struct SH9Color
{
    vec3 c[9];
};

SH9 SHCosineLobe(in vec3 dir)
{
    SH9 sh;
    // Band 0
    sh.c[0] = 0.282095f * CosineA0;
    // Band 1
    sh.c[1] = 0.488603f * dir.y * CosineA1;
    sh.c[2] = 0.488603f * dir.z * CosineA1;
    sh.c[3] = 0.488603f * dir.x * CosineA1;
    // Band 2
    sh.c[4] = 1.092548f * dir.x * dir.y * CosineA2;
    sh.c[5] = 1.092548f * dir.y * dir.z * CosineA2;
    sh.c[6] = 0.315392f * (3.0f * dir.z * dir.z - 1.0f) * CosineA2;
    sh.c[7] = 1.092548f * dir.x * dir.z * CosineA2;
    sh.c[8] = 0.546274f * (dir.x * dir.x - dir.y * dir.y) * CosineA2;
    return sh;
}

vec3 ComputeSHIrradiance(in vec3 normal, in SH9Color radiance)
{
    // Compute the cosine lobe in SH, oriented about the normal direction
    SH9 shCosine = SHCosineLobe(normal);
    // Compute the SH dot product to get irradiance
    vec3 irradiance = vec3(0.0f);
    for(uint i = 0; i < 9; ++i)
        irradiance += radiance.c[i] * shCosine.c[i];
    return irradiance;
}
vec3 ComputeSHDiffuse(in vec3 normal, in SH9Color radiance, in vec3 diffuseAlbedo)
{
    // Diffuse BRDF is albedo / Pi
    return ComputeSHIrradiance(normal, radiance) * diffuseAlbedo * (1.0f / Pi);
}
