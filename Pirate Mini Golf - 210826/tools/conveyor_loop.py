# ============================================================================
#  Conveyor belt loop  |  Blender generator script
#  ---------------------------------------------------------------------------
#  A closed chain of bones laid out around a racetrack (stadium) path. The
#  whole chain travels around the loop, carrying the skinned belt surface with
#  it, so the top run flows one way, curls over the end roller, and comes back
#  underneath. This is the real conveyor rig, not a wave faked on a flat plane.
#
#  The loop is SHIFT PERIODIC: over one animation cycle every bone advances by
#  exactly one segment, landing on its neighbour's slot. Because every segment
#  is identical, the surface at the end of the cycle is the same surface it
#  started as, so it loops forever with no pop and the clip stays tiny.
#
#  Run it either way:
#    * Blender UI  : Scripting tab -> Open -> Run Script
#    * Headless    : blender --background --python conveyor_loop.py
#                    (or with the `bpy` pip module: python conveyor_loop.py)
# ============================================================================

import bpy, bmesh, math, os
from mathutils import Matrix, Vector

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
CFG = {
    # ---- loop shape (metres) ----
    "straight":      8.0,    # length of the flat top / bottom run
    "radius":        1.2,    # end roller radius (how tightly the belt curls)
    "width":         4.0,    # belt width, along Y
    "seg_width":     4,      # mesh divisions across the width

    # ---- rig ----
    "bone_count":    40,     # bones around the whole loop (uniform arc spacing)
    "bone_radius":   0.05,

    # ---- motion ----
    "fps":           30,
    "frames_per_seg": 20,    # animation frames per segment of belt travel

    # ---- surface ripple, baked per bone so it rides along with the belt ----
    # Without this the belt is a featureless band and the travel is invisible
    # unless you texture it. The ripple wavelength is ripple_segs segments, and
    # that is also how far the belt advances per cycle, which is what keeps the
    # loop seamless. ripple_segs must divide bone_count exactly.
    "ripple_amp":    0.07,   # metres along the belt normal; 0.0 disables it
    "ripple_segs":   5,      # ripple wavelength, in belt segments

    # ---- extras ----
    "top_at_origin": True,   # put the top run at z=0 so it drops straight into
                             # a scene at ground level; False centres the loop
    "build_rollers": True,   # the two end rollers, static
    "water_color":   (0.043, 0.31, 0.38, 0.82),
    "water_rough":   0.18,
    "roller_color":  (0.18, 0.17, 0.16, 1.0),

    # ---- output ----
    "action_name":   "Flow",
    "outdir":        os.path.dirname(os.path.abspath(__file__)),
    "basename":      "conveyor_loop",
    "export_glb":    True,
    "save_blend":    True,
}

S    = CFG["straight"]
R    = CFG["radius"]
W    = CFG["width"]
N    = CFG["bone_count"]
PERI = 2.0 * S + 2.0 * math.pi * R      # total loop length
DS   = PERI / N                          # arc length of one belt segment
TAU  = math.pi * 2.0
# with a ripple the belt must advance a whole ripple wavelength per cycle so
# the pattern lands back on itself; without one, a single segment is enough
ADV  = CFG["ripple_segs"] if CFG["ripple_amp"] > 0.0 else 1
F    = CFG["frames_per_seg"] * ADV       # frames in one animation cycle
ZOFF = -R if CFG["top_at_origin"] else 0.0


# ---------------------------------------------------------------------------
# the stadium path, parametrised by arc length
#   s = 0 sits at the start of the top run; travel on the top run is +X
# ---------------------------------------------------------------------------
def path(s):
    """Return (position, tangent, outward_normal) at arc length s."""
    s = s % PERI
    z0 = Vector((0.0, 0.0, ZOFF))
    arc = math.pi * R
    if s < S:                                    # top run, +X
        return (Vector((-S * 0.5 + s, 0.0, R)) + z0,
                Vector((1.0, 0.0, 0.0)),
                Vector((0.0, 0.0, 1.0)))
    s -= S
    if s < arc:                                  # right end roller, curling down
        phi = s / R
        n = Vector((math.sin(phi), 0.0, math.cos(phi)))
        return (Vector((S * 0.5, 0.0, 0.0)) + n * R + z0,
                Vector((math.cos(phi), 0.0, -math.sin(phi))),
                n)
    s -= arc
    if s < S:                                    # bottom run, -X
        return (Vector((S * 0.5 - s, 0.0, -R)) + z0,
                Vector((-1.0, 0.0, 0.0)),
                Vector((0.0, 0.0, -1.0)))
    s -= S
    phi = s / R                                  # left end roller, curling up
    n = Vector((-math.sin(phi), 0.0, -math.cos(phi)))
    return (Vector((-S * 0.5, 0.0, 0.0)) + n * R + z0,
            Vector((-math.cos(phi), 0.0, math.sin(phi))),
            n)


def heading(tangent):
    return math.atan2(tangent.z, tangent.x)


# ---------------------------------------------------------------------------
def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = CFG["fps"]
    sc.frame_start = 1
    sc.frame_end = F
    sc.unit_settings.system = 'METRIC'


def make_material(name, rgba, roughness, blend=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Metallic"].default_value = 0.0
    if blend:
        b.inputs["Alpha"].default_value = rgba[3]
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = 'BLENDED'
        elif hasattr(mat, "blend_method"):
            mat.blend_method = 'BLEND'
    return mat


# ---------------------------------------------------------------------------
# belt surface: one ring of verts per bone, sitting exactly on that bone's head
# ---------------------------------------------------------------------------
def build_belt():
    me = bpy.data.meshes.new("BeltSurface")
    ob = bpy.data.objects.new("BeltSurface", me)
    bpy.context.collection.objects.link(ob)

    bm = bmesh.new()
    nw = CFG["seg_width"]
    rings = []
    for i in range(N + 1):                 # ring N duplicates ring 0 (UV seam)
        p, _, _ = path((i % N) * DS)
        ring = []
        for j in range(nw + 1):
            y = -W * 0.5 + W * j / nw
            ring.append(bm.verts.new((p.x, y, p.z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()

    uv = bm.loops.layers.uv.new("UVMap")
    for i in range(N):
        for j in range(nw):
            f = bm.faces.new((rings[i][j], rings[i][j + 1],
                              rings[i + 1][j + 1], rings[i + 1][j]))
            us = [(j / nw, i), ((j + 1) / nw, i),
                  ((j + 1) / nw, i + 1), (j / nw, i + 1)]
            for loop, c in zip(f.loops, us):
                loop[uv].uv = c

    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(make_material("M_Water", CFG["water_color"],
                                      CFG["water_rough"], blend=True))
    ob["ring_count"] = N + 1
    ob["verts_per_ring"] = nw + 1
    return ob


# ---------------------------------------------------------------------------
# armature: one bone per segment, head on the path, tail on the next slot
# ---------------------------------------------------------------------------
def build_armature():
    arm = bpy.data.armatures.new("BeltRig")
    ob = bpy.data.objects.new("BeltRig", arm)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')

    root = arm.edit_bones.new("root")
    root.head = (0.0, 0.0, ZOFF)
    root.tail = (0.0, 0.0, ZOFF - R * 0.6)

    for i in range(N):
        h, _, _ = path(i * DS)
        t, _, _ = path((i + 1) * DS)
        b = arm.edit_bones.new("belt_%02d" % i)
        b.head = h
        b.tail = t
        b.parent = root            # parented but NOT connected, so each bone
        b.use_connect = False      # can be posed with an absolute transform
        b.head_radius = b.tail_radius = CFG["bone_radius"]

    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


# ---------------------------------------------------------------------------
# skinning: ring i is rigid to bone i, so each belt facet is a rigid slat
# ---------------------------------------------------------------------------
def skin(mesh_ob, arm_ob):
    groups = [mesh_ob.vertex_groups.new(name="belt_%02d" % i) for i in range(N)]
    per_ring = mesh_ob["verts_per_ring"]
    for i in range(N + 1):
        bone = i % N
        idx = [i * per_ring + j for j in range(per_ring)]
        groups[bone].add(idx, 1.0, 'REPLACE')

    mod = mesh_ob.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm_ob
    mesh_ob.parent = arm_ob
    mesh_ob.matrix_parent_inverse = arm_ob.matrix_world.inverted()


# ---------------------------------------------------------------------------
# animation: slide every bone forward along the path by advance_segs segments
# ---------------------------------------------------------------------------
def animate(arm_ob, extra_frame=False):
    bpy.context.view_layer.objects.active = arm_ob
    bpy.ops.object.mode_set(mode='POSE')

    arm_ob.animation_data_create()
    act = bpy.data.actions.new(CFG["action_name"])
    act.use_fake_user = True
    arm_ob.animation_data.action = act

    bones = [arm_ob.pose.bones["belt_%02d" % i] for i in range(N)]
    for pb in bones:
        pb.rotation_mode = 'QUATERNION'

    rest = []
    for i, pb in enumerate(bones):
        _, tan, _ = path(i * DS)
        rest.append((pb.bone.matrix_local.copy(),
                     pb.bone.head_local.copy(),
                     heading(tan)))

    ripple = [CFG["ripple_amp"] * math.sin(TAU * i / CFG["ripple_segs"])
              for i in range(N)]

    prev_q = [None] * N
    last = F + 1 if extra_frame else F
    for f in range(1, last + 1):
        off = (f - 1) / F * ADV * DS
        bpy.context.scene.frame_set(f)
        for i, pb in enumerate(bones):
            p, tan, nrm = path(i * DS + off)
            rest_mat, head, th_rest = rest[i]
            rot = Matrix.Rotation(th_rest - heading(tan), 4, 'Y')
            target = p + nrm * ripple[i]
            pb.matrix = (Matrix.Translation(target) @ rot
                         @ Matrix.Translation(-head) @ rest_mat)

            # keep quaternions on the same hemisphere frame to frame
            q = pb.rotation_quaternion
            if prev_q[i] is not None and q.dot(prev_q[i]) < 0.0:
                pb.rotation_quaternion = -q
            prev_q[i] = pb.rotation_quaternion.copy()

            pb.keyframe_insert("location", frame=f, group=pb.name)
            pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)

    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.scene.frame_set(1)


# ---------------------------------------------------------------------------
def build_rollers():
    mat = make_material("M_Roller", CFG["roller_color"], 0.55)
    parts = []
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20, radius=R * 0.92, depth=W * 0.98,
            location=(sx * S * 0.5, 0.0, ZOFF),
            rotation=(math.radians(90), 0.0, 0.0))
        o = bpy.context.active_object
        o.data.materials.append(mat)
        parts.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    j = bpy.context.active_object
    j.name = j.data.name = "Rollers"
    return j


# ---------------------------------------------------------------------------
def export():
    out = CFG["outdir"]
    blend = os.path.join(out, CFG["basename"] + ".blend")
    glb = os.path.join(out, CFG["basename"] + ".glb")
    bpy.context.scene.frame_end = F          # export 1..F only
    if CFG["save_blend"]:
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        print("saved", blend)
    if CFG["export_glb"]:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(
            filepath=glb, export_format='GLB', export_yup=True,
            export_apply=False, export_skins=True, export_animations=True,
            export_animation_mode='ACTIONS', export_bake_animation=True,
            export_frame_range=True, export_frame_step=1,
            export_optimize_animation_size=False, export_def_bones=False,
            export_materials='EXPORT')
        print("exported", glb)


# ---------------------------------------------------------------------------
def main(extra_frame=False):
    if CFG["ripple_amp"] > 0.0 and N % CFG["ripple_segs"] != 0:
        raise ValueError("ripple_segs (%d) must divide bone_count (%d) exactly"
                         % (CFG["ripple_segs"], N))
    wipe()
    belt = build_belt()
    rig = build_armature()
    skin(belt, rig)
    animate(rig, extra_frame=extra_frame)
    if CFG["build_rollers"]:
        build_rollers()
    export()
    speed = ADV * DS / (F / CFG["fps"])
    print("done: %d bones, loop %.3f m, segment %.3f m, %d frame cycle, "
          "belt speed %.2f m/s" % (N, PERI, DS, F, speed))


if __name__ == "__main__":
    main()
