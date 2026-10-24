import type { HassEntities } from 'home-assistant-js-websocket';
import { guestsOf, nodeStats, uptime } from './proxmox';

const s = (state: string, attributes: Record<string, unknown> = {}) => ({ state, attributes });
const e = {
  'sensor.node_hs_cpu_used': s('36.7'), 'sensor.node_hs_memory_used': s('16'), 'sensor.node_hs_memory_free': s('4'),
  'sensor.node_hs_memory_used_percentage': s('80'), 'sensor.node_hs_version': s('9.2.3'), 'sensor.node_hs_last_boot': s('unknown'),
  'sensor.lxc_jellyfin_107_node': s('hs'), 'sensor.lxc_jellyfin_107_status': s('running', { friendly_name: 'LXC jellyfin (107) Status' }),
  'sensor.lxc_jellyfin_107_cpu_used': s('2'), 'sensor.lxc_jellyfin_107_ip_address': s('192.168.1.17'),
  'sensor.qemu_talos_kubernetes_2_102_node': s('hs'), 'sensor.qemu_talos_kubernetes_2_102_status': s('running', { friendly_name: 'QEMU talos-kubernetes-2 (102) Status' }),
  'sensor.qemu_talos_kubernetes_2_102_cpu_used': s('28.8'),
  'sensor.qemu_tiny11_base_100_node': s('hs'), 'sensor.qemu_tiny11_base_100_status': s('stopped'),
  'sensor.qemu_ha_110_node': s('other'),
} as unknown as HassEntities;

describe('proxmox', () => {
  it('collects node stats, total memory from used + free', () => {
    expect(nodeStats(e, 'hs')).toMatchObject({ cpu: 36.7, mem: 80, memUsed: 16, memTotal: 20, version: '9.2.3', boot: null, disk: null });
  });
  it('lists guests on the node: running + busiest first, names from friendly_name', () => {
    expect(guestsOf(e, 'hs').map(g => [g.type, g.name, g.vmid, g.running])).toEqual([
      ['VM', 'talos-kubernetes-2', 102, true], ['CT', 'jellyfin', 107, true], ['VM', 'tiny11-base', 100, false],
    ]);
    expect(guestsOf(e, 'hs')[1].ip).toBe('192.168.1.17');
  });
  it('formats uptime', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    expect(uptime('2026-10-24T02:00:00Z', now)).toBe('10 órája');
    expect(uptime('2026-08-14T12:00:00Z', now)).toBe('71 napja');
    expect(uptime(null, now)).toBe('–');
  });
});
