import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)

def material(name, color, metallic=.55, rough=.34, glow=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic; p.inputs['Roughness'].default_value = rough
    if glow: p.inputs['Emission Color'].default_value = (*color, 1); p.inputs['Emission Strength'].default_value = glow
    return m

def box(name, loc, scale, mat, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Machined edges','BEVEL'); b.width=bevel; b.segments=3
        o.modifiers.new('Panel normals','WEIGHTED_NORMAL')
    return o

def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth=True
    return o

def cylinder(name, loc, radius, depth, mat, rotation=(0,0,0), vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    b=o.modifiers.new('Edge bevel','BEVEL'); b.width=.035; b.segments=2; o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o

def panel(name, points, z, thickness, mat):
    n=len(points); verts=[(x,y,z+h) for h in [-thickness/2,thickness/2] for x,y in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.materials.append(mat)
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    b=o.modifiers.new('Armored edges','BEVEL'); b.width=.045; b.segments=3; o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o

def hull(name, lengths, mat):
    # Cross-section rings give the fuselage a sculpted silhouette.
    verts=[]; segments=16
    for y,width,height,z in lengths:
        verts.extend((math.cos(i*math.tau/segments)*width,y,z+math.sin(i*math.tau/segments)*height) for i in range(segments))
    faces=[]
    for row in range(len(lengths)-1):
        for i in range(segments):
            a=row*segments+i; b=row*segments+(i+1)%segments; faces.append((a,b,b+segments,a+segments))
    faces += [tuple(range(segments-1,-1,-1)),tuple(range((len(lengths)-1)*segments,len(lengths)*segments))]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.materials.append(mat)
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    for f in mesh.polygons:f.use_smooth=True
    return o

def setup(ortho, size):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene; s.render.engine='CYCLES'; s.cycles.samples=32; s.cycles.use_denoising=True
    s.render.resolution_x=size; s.render.resolution_y=size; s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG'; s.render.image_settings.color_mode='RGBA'; s.render.film_transparent=True
    s.world=bpy.data.worlds.new('Studio'); s.world.use_nodes=True; s.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.4,.49,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    s.view_settings.view_transform='AgX'; s.view_settings.look='AgX - Medium High Contrast'
    bpy.ops.object.camera_add(location=(0,0,24)); camera=bpy.context.object; camera.data.type='ORTHO'; camera.data.ortho_scale=ortho; s.camera=camera
    for pos,energy,color,size in [((-6,8,12),1800,(1,.83,.62),7),((5,-4,8),1150,(.57,.78,1),5),((0,-8,5),800,(1,.32,.13),4)]:
        bpy.ops.object.light_add(type='AREA', location=pos); light=bpy.context.object; light.data.energy=energy; light.data.color=color; light.data.shape='DISK'; light.data.size=size
        light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
    return s

def aircraft(kind):
    setup(7 if kind!='heavy' else 8,640)
    red=material('Crimson enamel',(.62,.027,.037)); olive=material('Forest armor',(.16,.20,.14)); grey=material('Graphite gunmetal',(.13,.17,.19))
    cream=material('Ivory markings',(.84,.82,.63),.35); steel=material('Titanium',(.34,.4,.43),.8); black=material('Rubber and intakes',(.015,.023,.029),.1)
    gold=material('Brass trim',(.46,.30,.09),.7); glass=material('Armored cockpit',(.02,.19,.25),.8,.17); emit=material('Engine core',(.9,.23,.025),.3,.3,4)
    main=red if kind=='player' else olive if kind=='fighter' else grey
    long=2.45 if kind!='heavy' else 2.35
    hull('Tapered fuselage',[(-long,.24,.20,.22),(-1.5,.49,.32,.3),(-.2,.50,.38,.32),(1.1,.32,.28,.3),(long,.045,.05,.26)],main)
    for side in [-1,1]:
        def pts(values):return [(side*x,y) for x,y in values]
        panel('Swept main wing',pts([(.28,.8),(1.25,.2),(2.65,-1.25),(2.55,-1.6),(.5,-1.13)]),.18,.20,main)
        panel('Wing armor inlay',pts([(.65,.18),(1.05,.12),(2.15,-1.15),(1.64,-1.05)]),.31,.045,cream if kind=='player' else gold)
        panel('Rear stabilizer',pts([(.2,-1.5),(1.25,-2.25),(1.08,-2.6),(.24,-2.15)]),.5,.10,main)
        x=side*.72
        hull('Engine nacelle',[(-2.05,.24,.24,.30),(-1.6,.34,.28,.31),(-.5,.31,.25,.30),(.55,.19,.20,.29)],main)
        cylinder('Exhaust shroud',(x,-1.95,.31),.21,.34,black,(math.pi/2,0,0))
        # hull center is moved to the nacelle x position.
        bpy.data.objects['Engine nacelle' if side==-1 else 'Engine nacelle.001'].location.x=x
        cylinder('Exhaust rim',(x,-2.10,.31),.24,.10,steel,(math.pi/2,0,0))
        sphere('Engine glow',(x,-2.19,.32),(.16,.09,.16),emit)
        box('Wing cannon',(side*1.83,-.84,.2),(.12,1.5,.16),steel,.025)
        sphere('Missile nose',(side*2.12,-.58,.24),(.11,.25,.10),cream)
        box('Missile casing',(side*2.12,-.98,.23),(.18,.56,.17),cream,.025)
        for y in [-1.12,-.89,-.65]:box('Air intake louvers',(x,y,.57),(.39,.035,.025),black,.008)
        for x2,y2 in [(1.1,-.15),(1.6,-.60),(2,-1.0)]:sphere('Panel rivet',(side*x2,y2,.32),(.023,.023,.01),steel)
    sphere('Glass canopy',(0,.75,.63),(.27,.64,.17),glass)
    box('Canopy spine',(0,.72,.78),(.055,1.2,.035),steel,.01)
    panel('Vertical tail',[(0,-1.10),(.10,-1.7),(0,-2.2),(-.10,-1.7)],.83,.15,main)
    panel('Nose accent',[(-.06,1.3),(.06,1.3),(.025,2.25),(-.025,2.25)],.57,.03,cream if kind=='player' else gold)
    if kind=='heavy':
        for side in [-1,1]:
            box('Armored gun pod',(side*1.3,-.45,.54),(.48,1.30,.35),grey)
            cylinder('Turret',(side*1.3,-.2,.84),.31,.24,gold)
            box('Gun barrel',(side*1.3,.32,.86),(.11,1.2,.12),steel,.02)
    bpy.context.scene.render.filepath=str(OUT/f'{kind}.png'); bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools'/f'{kind}.blend'))

def tank():
    setup(4.4,448); olive=material('Olive armor',(.17,.21,.12)); metal=material('Machined tracks',(.07,.09,.08),.8); steel=material('Barrel metal',(.24,.29,.26)); brass=material('Brass decals',(.48,.37,.12))
    box('Tank body',(0,-.1,.24),(1.55,2.15,.50),olive,.13)
    for side in [-1,1]:
        box('Track body',(side*.92,-.1,.15),(.38,2.2,.28),metal,.10)
        for y in [i*.16-1.1 for i in range(14)]:box('Track segment',(side*.92,y,.31),(.43,.08,.07),steel,.01)
        box('Armor stripe',(side*.5,.1,.51),(.12,1.4,.025),brass,.01)
    cylinder('Turret base',(0,-.2,.61),.59,.2,steel)
    box('Turret armor',(0,-.22,.83),(.97,1.03,.42),olive,.13)
    cylinder('Turret hatch',(-.2,-.34,1.06),.19,.04,brass)
    box('Main gun',(0,.9,.84),(.17,1.7,.17),steel,.025)
    box('Muzzle',(0,1.72,.84),(.25,.25,.25),metal,.025)
    bpy.context.scene.render.filepath=str(OUT/'tank.png'); bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools'/'tank.blend'))

def boss():
    setup(12,896); gray=material('Fortress armor',(.14,.18,.19),.7); silver=material('Titanium panels',(.39,.44,.43),.8); black=material('Armored recesses',(.018,.027,.029)); gold=material('Hazard bronze',(.61,.42,.12),.65); glow=material('Reactor glow',(.96,.21,.035),.3,.25,4); glass=material('Cockpit',(.03,.22,.28),.7)
    panel('Main armored hull',[(-.9,3.6),(.9,3.6),(1.25,.1),(.8,-3.2),(-.8,-3.2),(-1.25,.1)],.35,.55,gray)
    box('Center spine',(0,.1,.73),(1.15,5.7,.60),silver,.16)
    for side in [-1,1]:
        def pts(values):return [(side*x,y) for x,y in values]
        panel('Swept fortress wing',pts([(.6,1.6),(4.5,.5),(4.9,-.4),(4.45,-2),(1.0,-1.55)]),.15,.5,gray)
        panel('Wing plating',pts([(1.5,.9),(4.0,.25),(4.35,-.25),(3.9,-1.3),(1.5,-1.0)]),.49,.16,silver)
        panel('Identification stripe',pts([(2.7,.47),(3.05,.37),(3.35,-1.27),(3,-1.22)]),.60,.025,gold)
        box('Engine housing',(side*2.0,-1.55,.69),(1.14,2.8,.87),gray,.20)
        for x in [-.28,.28]:
            cylinder('Jet nozzle',(side*2+x,-2.88,.67),.22,.30,black,(math.pi/2,0,0)); sphere('Jet core',(side*2+x,-3.03,.67),(.17,.06,.17),glow)
        cylinder('Gun turret',(side*3.48,-.28,.91),.65,.36,gray)
        cylinder('Turret plate',(side*3.48,-.28,1.10),.46,.07,gold)
        for x in [-.2,.2]:box('Twin gun',(side*3.48+x,.47,1.1),(.13,1.7,.15),silver,.03)
        for i in range(6):box('Vent',(side*2,-.4-i*.18,1.16),(.8,.075,.045),black,.008)
        for y in [-.7,-.3,.1,.5]:sphere('Metal fastener',(side*1.48,y,.7),(.055,.055,.04),gold)
    sphere('Forward cockpit',(0,2.0,1.1),(.53,.87,.25),glass)
    cylinder('Reactor outer ring',(0,-.7,1.10),.62,.18,black)
    cylinder('Reactor bronze ring',(0,-.7,1.20),.46,.10,gold)
    cylinder('Reactor core',(0,-.7,1.27),.32,.08,glow)
    for y in [-2.1,-1.8]:box('Rear central plate',(0,y,1.1),(.8,.17,.07),gold,.015)
    bpy.context.scene.render.filepath=str(OUT/'boss.png'); bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools'/'boss.blend'))

for kind in ['player','fighter','heavy']:aircraft(kind)
tank(); boss()
print('RAIJIN: five Blender models and rendered sprites saved.')
