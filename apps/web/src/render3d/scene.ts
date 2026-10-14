import * as THREE from 'three';
import type { ProjectStore } from '@gharplan/core-model';
import type { MeshData, SceneBundle } from './types';

export function sameMesh(a: MeshData, b: MeshData): boolean {
  const same = (x: ArrayLike<number>, y: ArrayLike<number>) => {
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  };
  return a.id === b.id && a.entityId === b.entityId && a.category === b.category && same(a.positions, b.positions) && same(a.normals, b.normals) && same(a.uv, b.uv) &&
    a.groups.length === b.groups.length && a.groups.every((g, i) => g.start === b.groups[i]!.start && g.count === b.groups[i]!.count && g.materialId === b.groups[i]!.materialId);
}
export function bufferGeometry(data: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
  data.groups.forEach((g, i) => geometry.addGroup(g.start, g.count, i));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
/** GPU adapter: reuses identical meshes/materials, disposes replaced/removed resources. */
export class SceneAdapter {
  group = new THREE.Group();
  #meshes = new Map<string, { data: MeshData; mesh: THREE.Mesh }>();
  #materials = new Map<string, THREE.MeshStandardMaterial>();
  #furniture = new Map<string, THREE.Mesh>();
  #placeholder = new THREE.MeshStandardMaterial({ color: '#778d76', roughness: 0.8 });
  #ceiling=new THREE.MeshStandardMaterial({color:'#f8f8f2',roughness:1,metalness:0,side:THREE.DoubleSide});
  #showCeilings=false;
  #unitBox = new THREE.BoxGeometry(1, 1, 1);
  lastChanges = { replaced: [] as string[], kept: [] as string[], removed: [] as string[] };
  apply(bundle: SceneBundle, document: ReturnType<ProjectStore['getSnapshot']>['document']): void {
    this.lastChanges = { replaced: [], kept: [], removed: [] };
    const wantedMaterials = new Set(document.materials.map(m => m.id));
    for (const m of document.materials) {
      const material = this.#materials.get(m.id) ?? new THREE.MeshStandardMaterial();
      material.color.set(m.baseColor); material.roughness = m.roughness; material.metalness = m.metalness;
      this.#materials.set(m.id, material);
    }
    const wanted = new Set(bundle.meshes.map(m => m.id));
    for (const [id, entry] of this.#meshes) if (!wanted.has(id)) { this.group.remove(entry.mesh); entry.mesh.geometry.dispose(); this.#meshes.delete(id); this.lastChanges.removed.push(id); }
    for (const data of bundle.meshes) {
      const previous = this.#meshes.get(data.id);
      if (previous && sameMesh(previous.data, data)) { this.lastChanges.kept.push(data.id); continue; }
      const geometry = bufferGeometry(data), materials = data.groups.map(g => data.category==='ceiling'?this.#ceiling:this.#materials.get(g.materialId)!);
      const mesh = previous?.mesh ?? new THREE.Mesh();
      if (previous) mesh.geometry.dispose(); else this.group.add(mesh);
      mesh.geometry = geometry; mesh.material = materials;mesh.visible=data.category!=='ceiling'||this.#showCeilings; mesh.userData = { entityId: data.entityId, category: data.category };
      this.#meshes.set(data.id, { data, mesh }); this.lastChanges.replaced.push(data.id);
    }
    for (const [id, material] of this.#materials) if (!wantedMaterials.has(id)) { material.dispose(); this.#materials.delete(id); }
    const furniture = new Set(document.furniture.map(f => f.id));
    for (const [id, mesh] of this.#furniture) if (!furniture.has(id)) { this.group.remove(mesh); this.#furniture.delete(id); }
    for (const item of document.furniture) {
      const mesh = this.#furniture.get(item.id) ?? new THREE.Mesh(this.#unitBox, this.#placeholder);
      if (!this.#furniture.has(item.id)) { this.#furniture.set(item.id, mesh); this.group.add(mesh); }
      mesh.scale.set(item.size.w / 1000, item.size.h / 1000, item.size.d / 1000);
      mesh.position.set(item.position.x / 1000, (document.floors[0]!.elevation + item.elevation + item.size.h / 2) / 1000, item.position.y / 1000);
      mesh.rotation.y = -item.rotationDeg * Math.PI / 180; mesh.userData = { entityId: item.id, category: 'furniture-placeholder' };
    }
  }
  setCeilingsVisible(visible:boolean):void{this.#showCeilings=visible;for(const {data,mesh}of this.#meshes.values())if(data.category==='ceiling')mesh.visible=visible;}
  mesh(id: string): THREE.Mesh | undefined { return this.#meshes.get(id)?.mesh; }
  dispose(): void {
    for (const { mesh } of this.#meshes.values()) mesh.geometry.dispose();
    for (const material of this.#materials.values()) material.dispose();
    this.#ceiling.dispose();this.#placeholder.dispose(); this.#unitBox.dispose(); this.#meshes.clear(); this.#materials.clear(); this.#furniture.clear(); this.group.clear();
  }
}
