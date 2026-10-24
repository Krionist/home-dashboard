import { Component, computed, inject } from '@angular/core';
import { W } from './config';
import { ConfigService } from './config.service';
import { HaService } from './ha.service';
import { Daytime, Season, sceneOf, sceneOverride } from './scene';

// seeded so the scene is identical on every load
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// canopy: overlapping blurred blobs around the crown; k = palette slot (0 left … 5 right, 6 accent), colour comes from the season
function canopy() {
  const r = rng(11);
  return Array.from({ length: 150 }, () => {
    const a = r() * Math.PI * 2, d = Math.pow(r(), .7);
    const x = 440 + Math.cos(a) * d * 330, y = 330 + Math.sin(a) * d * 190 * (Math.sin(a) > 0 ? .75 : 1); // flatter underside
    const k = Math.min(5, Math.max(0, Math.floor(((x - 140) / 620) * 5 + (r() - .3) * 2)));
    return { x: Math.round(x), y: Math.round(y), r: Math.round(14 + r() * 30), k: r() < .12 ? 6 : k, o: +(0.45 + r() * 0.45).toFixed(2) };
  });
}

// falling leaves / petals: start x, sideways drift, spin, size, timing, palette slot
function leaves() {
  const r = rng(29);
  return Array.from({ length: 26 }, () => ({
    x: Math.round(250 + r() * 1350), dx: Math.round(-160 + r() * 420), rot: Math.round(240 + r() * 600) * (r() < .5 ? -1 : 1),
    s: +(1.3 + r() * 1.3).toFixed(2), dur: +(14 + r() * 16).toFixed(1), delay: -+(r() * 30).toFixed(1), k: Math.floor(r() * 4),
  }));
}

// rain drops / snowflakes: x, timing, size
function particles(seed: number, n: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: Math.round(r() * 1700 - 50), dur: +(0.6 + r() * 0.5).toFixed(2), delay: -+(r() * 10).toFixed(2), s: +(0.6 + r()).toFixed(2), d: Math.round(-60 + r() * 120) }));
}

// night sky: stars in the upper half, away from the tree crown
function stars() {
  const r = rng(67);
  return Array.from({ length: 60 }, () => ({ x: Math.round(r() * 1600), y: Math.round(r() * 480), s: +(0.6 + r() * 1.1).toFixed(1), delay: -+(r() * 5).toFixed(1) }))
    .filter(p => Math.hypot((p.x - 440) / 360, (p.y - 330) / 220) > 1);
}

// cloud banks across the upper sky; how many show depends on cover
const CLOUDS = [[1180, 150, 260], [520, 110, 300], [1450, 300, 220], [850, 240, 280], [180, 220, 240], [1000, 60, 320]];

interface SeasonLook { canopy: string[]; canopyO: number; fall: string[]; falling: number; hill: [string, string, string, string]; glow: string }
const SEASON: Record<Season, SeasonLook> = {
  autumn: { canopy: ['#b81d3c', '#e0263f', '#f0432e', '#f56a2a', '#ff8f2e', '#ffb347', '#d6245a'], canopyO: 1, fall: ['#e0263f', '#ff3b4e', '#f0552e', '#c81d3a'], falling: 26,
    hill: ['#4a0f22', '#6e1430', '#8a2a1c', '#3a0a18'], glow: '#ff6a3d' },
  spring: { canopy: ['#e98fb4', '#f4a6c4', '#f7c6d9', '#ffd1e1', '#fbe3ec', '#ffffff', '#b5dc8c'], canopyO: 1, fall: ['#f7c6d9', '#ffd1e1', '#fbe3ec', '#f4a6c4'], falling: 18,
    hill: ['#1f3d24', '#2e5a2c', '#4a6e2e', '#16301c'], glow: '#ffb3cf' },
  summer: { canopy: ['#1a5c2a', '#237436', '#2e8a3a', '#3fa34a', '#5ab84f', '#7cc95a', '#2a7a5a'], canopyO: 1, fall: ['#3fa34a', '#5ab84f', '#7cc95a', '#2e8a3a'], falling: 4,
    hill: ['#1a3d1e', '#26562a', '#3d6a26', '#122c16'], glow: '#ffd36a' },
  winter: { canopy: ['#cfdbe6', '#dfe8f0', '#e6eef5', '#eef3f8', '#ffffff', '#ffffff', '#cfdbe6'], canopyO: .3, fall: [], falling: 0,
    hill: ['#8e9cab', '#b4c0cc', '#c8d4e0', '#6f7c8a'], glow: '#a8c8ff' },
};

// sky stops (top-left → bottom-right), cool corner light, dim overlay (top, bottom)
const TIME: Record<Daytime, { sky: [string, string, string, string]; cool: number; glow: number; dim: [number, number] }> = {
  day: { sky: ['#0d4656', '#1b2a33', '#2a1a1c', '#3a1414'], cool: .28, glow: .32, dim: [.35, .6] },
  dusk: { sky: ['#1d2a52', '#3a2440', '#5a2a24', '#7a3416'], cool: .12, glow: .6, dim: [.35, .6] },
  night: { sky: ['#050816', '#0a0f22', '#0e0c1a', '#120a14'], cool: .06, glow: 0, dim: [.3, .55] },
};

// a tree on a hillside that follows the real weather: season colours, day/dusk/night sky, clouds, rain, snow, fog, lightning, wind
@Component({
  selector: 'app-bg',
  template: `
    @let s = scene(); @let look = SEASON[s.season]; @let t = TIME[s.time];
    <svg class="bg" [class]="'bg ' + s.season + ' ' + s.time" [class.storm]="s.storm" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      [style.--wind]="s.wind" [style.--sway.deg]="0.8 + s.wind * 2.5" [style.--sway-dur.s]="9 - s.wind * 5">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="t.sky[0]" /><stop offset=".45" [attr.stop-color]="t.sky[1]" /><stop offset=".8" [attr.stop-color]="t.sky[2]" /><stop offset="1" [attr.stop-color]="t.sky[3]" />
        </linearGradient>
        <radialGradient id="glow" cx=".78" [attr.cy]="s.time === 'dusk' ? .85 : .72" r=".55">
          <stop offset="0" [attr.stop-color]="s.time === 'dusk' ? '#ff7a3d' : look.glow" [attr.stop-opacity]="t.glow * (1 - s.clouds * .7)" />
          <stop offset="1" [attr.stop-color]="look.glow" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="cool" cx=".12" cy=".08" r=".5"><stop offset="0" stop-color="#3fd0e0" [attr.stop-opacity]="t.cool * (1 - s.clouds * .6)" /><stop offset="1" stop-color="#3fd0e0" stop-opacity="0" /></radialGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" [attr.stop-color]="look.hill[0]" /><stop offset=".5" [attr.stop-color]="look.hill[1]" /><stop offset="1" [attr.stop-color]="look.hill[2]" /></linearGradient>
        <linearGradient id="dim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0c0e" [attr.stop-opacity]="t.dim[0]" /><stop offset="1" stop-color="#0b0c0e" [attr.stop-opacity]="t.dim[1]" /></linearGradient>
        <filter id="blur-l" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22" /></filter>
        <filter id="blur-m" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="blur-s"><feGaussianBlur stdDeviation="1.5" /></filter>
        <path id="leaf" d="M0-7C5-5 7 1 0 8-7 1-5-5 0-7Z" />
      </defs>

      <rect width="1600" height="1000" fill="url(#sky)" />
      <rect width="1600" height="1000" fill="url(#cool)" />
      <rect width="1600" height="1000" fill="url(#glow)" />
      <!-- overcast: wash the sky towards grey -->
      <rect width="1600" height="1000" [attr.fill]="s.time === 'night' ? '#0c1018' : '#56626c'" [attr.opacity]="s.clouds * .28" />

      @if (s.time === 'night' && s.clouds < .7) {
        <g class="stars" [attr.opacity]="1 - s.clouds">
          @for (p of STARS; track $index) { <circle class="star" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.s" [style.animation-delay.s]="p.delay" /> }
        </g>
        <g class="moon" [attr.opacity]="1 - s.clouds * .8"><circle cx="1330" cy="150" r="70" fill="#dfe8ff" opacity=".08" filter="url(#blur-l)" /><circle cx="1330" cy="150" r="34" fill="#e8eefc" opacity=".85" /><circle cx="1345" cy="140" r="30" [attr.fill]="t.sky[1]" opacity=".9" /></g>
      }
      @if (s.time === 'day' && s.clouds < .6) {
        <circle cx="1300" cy="140" r="120" fill="#fff4d6" [attr.opacity]="(.18 - s.clouds * .25)" filter="url(#blur-l)" />
      }

      <!-- far mist banks -->
      <g class="mist m1" filter="url(#blur-l)"><ellipse cx="1150" cy="330" rx="380" ry="120" fill="#c9d6dc" opacity=".08" /><ellipse cx="1350" cy="560" rx="320" ry="90" fill="#ffb08a" opacity=".07" /></g>

      <!-- clouds -->
      <g class="clouds" filter="url(#blur-l)">
        @for (c of CLOUDS.slice(0, cloudCount()); track $index) {
          <g class="cloud" [style.animation-delay.s]="-$index * 13">
            <ellipse [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.rx]="c[2]" [attr.ry]="c[2] * .32" [attr.fill]="s.time === 'night' ? '#1c2230' : '#8c98a4'" [attr.opacity]="0.25 + s.clouds * .35" />
            <ellipse [attr.cx]="c[0] + c[2] * .4" [attr.cy]="c[1] - 20" [attr.rx]="c[2] * .55" [attr.ry]="c[2] * .25" [attr.fill]="s.time === 'night' ? '#222a3a' : '#a7b2bc'" [attr.opacity]="0.2 + s.clouds * .3" />
          </g>
        }
      </g>
      @if (s.storm) { <rect class="flash" width="1600" height="1000" fill="#dfe8ff" /> }

      <!-- hillside -->
      <path d="M-50 1000V800C200 700 420 640 620 660S1100 760 1650 720V1000Z" fill="url(#hill)" opacity=".75" filter="url(#blur-m)" />
      <path d="M-50 1000V880C260 800 560 790 900 840S1400 900 1650 860V1000Z" [attr.fill]="look.hill[3]" opacity=".8" filter="url(#blur-m)" />

      <!-- tree: trunk + branches, canopy sways from the trunk base -->
      <g class="tree">
        <path d="M436 720C452 660 458 610 452 560 446 520 430 490 420 470L440 466C456 492 468 520 474 548 486 512 506 486 530 466L544 478C514 506 496 540 490 580 486 630 492 680 506 720Z" fill="#1a0c10" />
        <path class="branches" d="M430 478C410 440 380 410 330 385M425 470C428 430 420 400 404 360M536 472C580 446 630 430 690 400M520 482C560 488 610 500 680 494M490 560C450 548 400 548 340 560M480 520C496 470 500 430 520 380"
          fill="none" stroke="#1a0c10" stroke-width="7" stroke-linecap="round" />
        <path class="twigs" d="M330 385C300 370 270 372 240 360M404 360C396 330 400 300 380 270M690 400C720 380 740 360 770 352M680 494C710 500 740 520 770 520M520 380C530 340 560 310 590 290M340 560C310 568 280 590 250 600"
          fill="none" stroke="#1a0c10" stroke-width="3" stroke-linecap="round" />
        <g filter="url(#blur-m)">
          @for (b of CANOPY; track $index) { <circle [attr.cx]="b.x" [attr.cy]="b.y" [attr.r]="b.r" [attr.fill]="look.canopy[b.k]" [attr.opacity]="b.o * look.canopyO" /> }
        </g>
      </g>

      <!-- near mist drifting across -->
      <g class="mist m2" filter="url(#blur-l)"><ellipse cx="300" cy="760" rx="420" ry="80" fill="#d9c4c4" opacity=".07" /><ellipse cx="1000" cy="640" rx="360" ry="70" fill="#ffd2b8" opacity=".06" /></g>

      @if (s.fog) {
        <!-- fog: thick low banks over the hill and tree -->
        <g class="mist m2" filter="url(#blur-l)"><rect x="-100" y="420" width="1800" height="420" rx="200" fill="#c8ced4" opacity=".22" /><rect x="-100" y="640" width="1800" height="360" fill="#d6dade" opacity=".25" /></g>
      }
      @for (l of LEAVES.slice(0, look.falling + (s.wind > .5 ? 6 : 0)); track $index) {
        <g class="leaf" [style.--x.px]="l.x" [style.--dx.px]="l.dx" [style.--rot.deg]="l.rot" [style.--s]="l.s"
          [style.animation-duration.s]="l.dur" [style.animation-delay.s]="l.delay">
          <use href="#leaf" [attr.fill]="look.fall[l.k] ?? look.canopy[l.k]" filter="url(#blur-s)" />
        </g>
      }
      @for (p of DROPS.slice(0, s.rain); track $index) {
        <line class="drop" x1="0" y1="0" x2="0" y2="26" [style.--x.px]="p.x" [style.animation-duration.s]="p.dur" [style.animation-delay.s]="p.delay" />
      }
      @for (p of FLAKES.slice(0, s.snow); track $index) {
        <circle class="flake" r="3" [style.--x.px]="p.x" [style.--dx.px]="p.d" [style.--s]="p.s" [style.animation-duration.s]="p.dur * 12" [style.animation-delay.s]="p.delay * 8" />
      }

      <!-- keep the dashboard readable on top -->
      <rect width="1600" height="1000" fill="url(#dim)" />
    </svg>`,
})
export class Background {
  private readonly ha = inject(HaService);
  private readonly cfg = inject(ConfigService);
  readonly CANOPY = canopy();
  readonly LEAVES = leaves();
  readonly DROPS = particles(41, 60);
  readonly FLAKES = particles(53, 60);
  readonly STARS = stars();
  readonly CLOUDS = CLOUDS;
  readonly SEASON = SEASON;
  readonly TIME = TIME;
  // the weather entity the clock widget already uses
  private readonly weatherId = computed(() =>
    this.cfg.config()?.pages.flatMap(p => p.columns.flatMap(c => c.widgets)).find((w): w is W<'clock-weather'> => w.type === 'clock-weather')?.entity);
  readonly scene = computed(() => {
    const e = this.ha.entities(), w = e[this.weatherId() ?? ''], sun = e['sun.sun'];
    return sceneOverride(location.search, sceneOf(w?.state, sun?.state, sun?.attributes['elevation'], w?.attributes['wind_speed'], new Date()));
  });
  readonly cloudCount = computed(() => Math.round(this.scene().clouds * CLOUDS.length));
}
