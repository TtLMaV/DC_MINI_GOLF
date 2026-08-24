# ============================================================================
#  Conveyor-belt water  |  Blender generator script
#  ---------------------------------------------------------------------------
#  Builds a water surface driven by a row of "slat" bones, exactly like the
#  bones on a conveyor belt. Each bone sits across the width of the strip and
#  runs a phase-shifted Gerstner orbit, so the crests travel along +X and the
#  loop is mathematically seamless (last frame pose == first frame pose).
#
#  Run it either way:
#    * Blender UI  : Scripting tab -> Open -> Run Script
#    * Headless    : blender --background --python conveyor_water.py
#                    (or with the `bpy` pip module: python conveyor_water.py)
#
#  Tweak everything in the CONFIG block below, then re-run. The script wipes
#  the scene each time, so it is safe to run over and over.
# ============================================================================

import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
CFG = {
    # ---- overall size (metres) ----
    "length":        8.0,    # travel direction, +X
    "width":         4.0,    # across the belt, Y
    "seg_length":    96,     # mesh subdivisions along the length
    "seg_width":     6,     # mesh subdivisions across the width

    # ---- rig ----
    "bone_count":    24,     # slat segments along the length (=> bone_count+1 bones)
    "bone_radius":   0.06,
    "weight_radius": 2.0,    # skin falloff in slat spacings (2.0 = 4 influences)

    # ---- motion ----
    "fps":           30,
    "loop_frames":   60,     # 60 @ 30fps = 2.0s loop
    # primary swell: cycles that fit along the length (integer = tiles cleanly)
    "wave1_cycles":  3,
    "wave1_amp":     0.090,   # vertical amplitude
    "wave1_steep":   0.60,   # 0 = pure up/down, 1 = sharp crests pushed forward
    "wave1_speed":   1,      # loop cycles per animation loop (integer)
    # secondary chop
    "wave2_cycles":  5,
    "wave2_amp":     0.038,
    "wave2_steep":   0.50,
    "wave2_speed":   2,
    "tilt":          15.0,   # max degrees the slat rocks to follow the wave face

    # ---- extras ----
    "build_trough":  True,   # stone channel around the water
    "water_color":   (0.043, 0.31, 0.38, 0.78),   # alpha < 1 -> glTF alphaMode BLEND
    "water_rough":   0.18,   # very low values give hard specular banding in engine
    "trough_color":  (0.26, 0.24, 0.21, 1.0),

    # ---- output ----
    "action_name":   "Flow",     # this becomes the glTF animation clip name
    "outdir":        os.path.dirname(os.path.abspath(__file__)),
    "basename":      "conveyor_water",
    "export_glb":    True,
    "save_blend":    True,
}

L   = CFG["length"]
W   = CFG["width"]
N   = CFG["bone_count"]
F   = CFG["loop_frames"]
TAU = math.pi * 2.0


# ---------------------------------------------------------------------------
# 0. clean slate
# ---------------------------------------------------------------------------
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = CFG["fps"]
    sc.frame_start = 1
    sc.frame_end = F + 1          # frame F+1 duplicates frame 1 -> clean loop
    sc.unit_settings.system = 'METRIC'


# ---------------------------------------------------------------------------
# 1. materials
# ---------------------------------------------------------------------------
def make_material(name, rgba, roughness, metallic=0.0, blend=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if blend:
        bsdf.inputs["Alpha"].default_value = rgba[3]
        # Blender 4.2+ renamed blend_method -> surface_render_method
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = 'BLENDED'
        elif hasattr(mat, "blend_method"):
            mat.blend_method = 'BLEND'
    return mat


# ---------------------------------------------------------------------------
# 2. water surface mesh
# ---------------------------------------------------------------------------
def build_water():
    me = bpy.data.meshes.new("WaterSurface")
    ob = bpy.data.objects.new("WaterSurface", me)
    bpy.context.collection.objects.link(ob)

    bm = bmesh.new()
    nx, ny = CFG["seg_length"], CFG["seg_width"]
    verts = []
    for i in range(nx + 1):
        col = []
        x = L * i / nx
        for j in range(ny + 1):
            y = -W * 0.5 + W * j / ny
            col.append(bm.verts.new((x, y, 0.0)))
        verts.append(col)
    bm.verts.ensure_lookup_table()

    uv = bm.loops.layers.uv.new("UVMap")
    for i in range(nx):
        for j in range(ny):
            f = bm.faces.new((verts[i][j], verts[i + 1][j],
                              verts[i + 1][j + 1], verts[i][j + 1]))
            us = [(i / nx, j / ny), ((i + 1) / nx, j / ny),
                  ((i + 1) / nx, (j + 1) / ny), (i / nx, (j + 1) / ny)]
            for loop, c in zip(f.loops, us):
                loop[uv].uv = c

    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(make_material("M_Water", CFG["water_color"], CFG["water_rough"], blend=True))
    return ob


# ---------------------------------------------------------------------------
# 3. armature: one "slat" bone per conveyor position
# ---------------------------------------------------------------------------
def build_armature():
    arm = bpy.data.armatures.new("ConveyorRig")
    ob = bpy.data.objects.new("ConveyorRig", arm)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')

    root = arm.edit_bones.new("root")
    root.head = (0.0, 0.0, -0.25)
    root.tail = (0.0, 0.0, 0.0)

    spacing = L / N
    for i in range(N + 1):          # +1 so the far end has its own bone (no wrap)
        x = i * spacing
        b = arm.edit_bones.new("slat_%02d" % i)
        b.head = (x, -W * 0.5, 0.0)
        b.tail = (x,  W * 0.5, 0.0)   # bone lies across the belt, like a slat
        b.parent = root
        b.use_connect = False
        b.head_radius = b.tail_radius = CFG["bone_radius"]

    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------------------
# 4. skinning: raised-cosine weights between the two nearest slats
#    (a partition of unity, so weights always sum to exactly 1, and every
#     vertex is only ever driven by bones within one slat spacing of it)
# ---------------------------------------------------------------------------
def skin(mesh_ob, arm_ob):
    spacing = L / N
    groups = [mesh_ob.vertex_groups.new(name="slat_%02d" % i) for i in range(N + 1)]

    radius = CFG["weight_radius"]          # in slat spacings; 2.0 -> 4 influences
    for v in mesh_ob.data.vertices:
        pos = min(max(v.co.x / spacing, 0.0), float(N))   # continuous bone coord
        i0 = min(int(math.floor(pos)), N - 1)
        cand = []
        for i in range(i0 - int(math.ceil(radius)) + 1, i0 + int(math.ceil(radius)) + 1):
            if 0 <= i <= N:
                d = abs(pos - i)
                if d < radius:
                    cand.append((i, 0.5 * (1.0 + math.cos(math.pi * d / radius))))
        cand.sort(key=lambda c: -c[1])
        cand = cand[:4]                    # glTF allows 4 influences per vertex
        tot = sum(w for _, w in cand)
        for i, w in cand:
            groups[i].add([v.index], w / tot, 'REPLACE')

    mod = mesh_ob.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm_ob
    mesh_ob.parent = arm_ob
    mesh_ob.matrix_parent_inverse = arm_ob.matrix_world.inverted()


# ---------------------------------------------------------------------------
# 5. animation: two stacked Gerstner waves travelling along +X
# ---------------------------------------------------------------------------
def gerstner(x, t):
    """Return (dx, dz, slope) for a point at rest-x, normalised time t in [0,1]."""
    dx = dz = slope = 0.0
    for cyc, amp, steep, spd in (
        (CFG["wave1_cycles"], CFG["wave1_amp"], CFG["wave1_steep"], CFG["wave1_speed"]),
        (CFG["wave2_cycles"], CFG["wave2_amp"], CFG["wave2_steep"], CFG["wave2_speed"]),
    ):
        k = TAU * cyc / L                 # spatial frequency (tiles over L)
        theta = k * x - TAU * spd * t     # travels toward +X as t increases
        dz += amp * math.sin(theta)
        dx -= steep * amp * math.cos(theta)   # orbital push, sharpens crests
        slope += amp * k * math.cos(theta)
    return dx, dz, slope


def animate(arm_ob):
    bpy.context.view_layer.objects.active = arm_ob
    bpy.ops.object.mode_set(mode='POSE')

    arm_ob.animation_data_create()
    act = bpy.data.actions.new(CFG["action_name"])
    arm_ob.animation_data.action = act

    bones = [arm_ob.pose.bones["slat_%02d" % i] for i in range(N + 1)]
    for pb in bones:
        pb.rotation_mode = 'QUATERNION'

    rest = {pb.name: (pb.bone.matrix_local.copy(), pb.bone.head_local.copy())
            for pb in bones}
    tilt_max = math.radians(CFG["tilt"])
    spacing = L / N

    for f in range(1, F + 2):                 # frame F+1 == frame 1
        t = (f - 1) / F
        bpy.context.scene.frame_set(f)
        for i, pb in enumerate(bones):
            x = i * spacing
            dx, dz, slope = gerstner(x, t)
            tilt = max(-tilt_max, min(tilt_max, -math.atan(slope)))

            rest_mat, head = rest[pb.name]
            m = (Matrix.Translation(head + Vector((dx, 0.0, dz)))
                 @ Matrix.Rotation(tilt, 4, 'Y')
                 @ Matrix.Translation(-head)
                 @ rest_mat)
            pb.matrix = m
            pb.keyframe_insert("location", frame=f, group=pb.name)
            pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)

    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    # keep the action alive through save/export even if it gets unassigned
    act.use_fake_user = True
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.scene.frame_set(1)


# ---------------------------------------------------------------------------
# 6. optional stone trough so the water reads as a channel
# ---------------------------------------------------------------------------
def build_trough():
    mat = make_material("M_Trough", CFG["trough_color"], 0.85)
    wall_t, wall_h, floor_d = 0.30, 0.55, 0.18
    parts = []

    def box(name, cx, cy, cz, sx, sy, sz):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
        o = bpy.context.active_object
        o.name = name
        o.scale = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat)
        parts.append(o)
        return o

    box("TroughFloor", L * 0.5, 0.0, -0.30 - floor_d * 0.5,
        L + wall_t * 2, W + wall_t * 2, floor_d)
    box("TroughWallL", L * 0.5, -(W + wall_t) * 0.5, -0.30 + wall_h * 0.5,
        L + wall_t * 2, wall_t, wall_h)
    box("TroughWallR", L * 0.5,  (W + wall_t) * 0.5, -0.30 + wall_h * 0.5,
        L + wall_t * 2, wall_t, wall_h)

    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = "Trough"
    joined.data.name = "Trough"
    return joined


# ---------------------------------------------------------------------------
# 7. export
# ---------------------------------------------------------------------------
def export():
    out = CFG["outdir"]
    os.makedirs(out, exist_ok=True)
    blend = os.path.join(out, CFG["basename"] + ".blend")
    glb   = os.path.join(out, CFG["basename"] + ".glb")

    if CFG["save_blend"]:
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        print("saved", blend)

    if CFG["export_glb"]:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(
            filepath=glb,
            export_format='GLB',
            export_yup=True,
            export_apply=False,          # must stay False: skinned mesh
            export_skins=True,
            export_animations=True,
            export_animation_mode='ACTIONS',
            export_bake_animation=True,
            export_frame_range=True,
            export_frame_step=1,
            export_optimize_animation_size=False,
            export_def_bones=False,
            export_materials='EXPORT',
        )
        print("exported", glb)


# ---------------------------------------------------------------------------
def main():
    wipe()
    water = build_water()
    rig   = build_armature()
    skin(water, rig)
    animate(rig)
    if CFG["build_trough"]:
        build_trough()
    export()
    print("done: %d bones, %d frame loop @ %d fps" % (N + 1, F, CFG["fps"]))


if __name__ == "__main__":
    main()
