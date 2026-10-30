import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';
import type { CategoryItem } from './categoryItemStore';

/** A unit inside a group; `factor` converts to the group's base unit (factor 1). */
export interface Unit {
  _id: string;
  name: string;
  factor: number;
  /** Quick-pick quantities for this unit (items may override). */
  presets: number[];
}

/** A kind of measurement — Weight, Volume, Count… */
export interface UnitGroup {
  _id: string;
  name: string;
  units: Unit[];
}

export interface UnitGroupFormData {
  name: string;
  units: { _id?: string; name: string; factor: number; presets: number[] }[];
}

interface UnitGroupState {
  groups: UnitGroup[];
  loaded: boolean;
  fetchGroups: () => Promise<void>;
  createGroup: (data: UnitGroupFormData) => Promise<void>;
  updateGroup: (id: string, data: UnitGroupFormData) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
}

// The server seeds Weight / Volume / Count on the first fetch.
const useUnitGroupStore = create<UnitGroupState>((set) => ({
  groups: [],
  loaded: false,

  fetchGroups: async () => {
    try {
      const { data } = await api.get('/unit-groups');
      set({ groups: data.groups, loaded: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch units');
    }
  },

  createGroup: async (formData) => {
    try {
      const { data } = await api.post('/unit-groups', formData);
      set((state) => ({ groups: [...state.groups, data.group] }));
      toast.success('Unit group created');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create unit group');
      throw error;
    }
  },

  updateGroup: async (id, formData) => {
    try {
      const { data } = await api.put(`/unit-groups/${id}`, formData);
      set((state) => ({ groups: state.groups.map((g) => (g._id === id ? data.group : g)) }));
      toast.success('Unit group updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update unit group');
      throw error;
    }
  },

  deleteGroup: async (id) => {
    try {
      await api.delete(`/unit-groups/${id}`);
      set((state) => ({ groups: state.groups.filter((g) => g._id !== id) }));
      toast.success('Unit group deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete unit group');
      throw error;
    }
  },
}));

// ── Item ↔ unit helpers ───────────────────────────────────────────────

export function groupOf(item: Pick<CategoryItem, 'unitGroupId'>, groups: UnitGroup[]): UnitGroup | undefined {
  return item.unitGroupId ? groups.find((g) => g._id === item.unitGroupId) : undefined;
}

/** Units offered for an item: its allowed subset, or the whole group. */
export function unitsFor(item: Pick<CategoryItem, 'unitGroupId' | 'allowedUnitIds'>, groups: UnitGroup[]): Unit[] {
  const group = groupOf(item, groups);
  if (!group) return [];
  const allowed = item.allowedUnitIds;
  return allowed && allowed.length > 0 ? group.units.filter((u) => allowed.includes(u._id)) : group.units;
}

/** Quick values for one unit of an item: the item's override, else the group's. */
export function presetsFor(item: Pick<CategoryItem, 'presetOverrides'>, unit: Unit): number[] {
  return item.presetOverrides?.find((o) => o.unitId === unit._id)?.values ?? unit.presets;
}

/** Default "500 g" label for an item ('' when it has none). */
export function defaultLabel(item: CategoryItem, groups: UnitGroup[]): string {
  // No saved default unit → the item's first unit (what the form preselects).
  const units = unitsFor(item, groups);
  const unit = units.find((u) => u._id === item.defaultUnitId) ?? units[0];
  const unitName = unit?.name ?? item.unit; // item.unit = legacy free text
  return [item.defaultQuantity, unitName].filter((p) => p !== undefined && p !== '').join(' ');
}

export default useUnitGroupStore;
