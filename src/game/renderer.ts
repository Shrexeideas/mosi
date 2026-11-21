import {
  SWAT_HIT_RADIUS,
  SWAT_WINDUP_DURATION,
  HUNTER_WINDUP_DURATION,
  WINDOW_ESCAPE_ZONE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  clamp,
  findNearestFoodSource,
  findNearestSipTarget,
  hasUpgrade,
} from './rules';
import { computeHumanPose } from './humanAnim';
import { COMEDY_CONDITIONS } from './upgrades';
import type {
  FloatingText,
  FoodSource,
  GameSimulation,
  Particle,
} from './types';

export interface CameraTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class EffectsPool {
  public readonly particles: Particle[] = [];
  public readonly texts: FloatingText[] = [];
  private dustTimer = 0;
  private zzzTimer = 0;
  private feverSweatTimer = 0;

  constructor() {
    for (let i = 0; i < 130; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: '#fff',
        kind: 'dust',
      });
    }
    for (let i = 0; i < 22; i++) {
      this.texts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -30,
        life: 0,
        maxLife: 1,
        text: '',
        color: '#fff',
        scale: 1,
      });
    }

    // Seed initial floating moonlight dust motes
    for (let i = 0; i < 18; i++) {
      this.spawnParticle({
        x: 90 + Math.random() * 440,
        y: 120 + Math.random() * 480,
        vx: 5 + Math.random() * 10,
        vy: -4 + Math.random() * 8,
        life: 2 + Math.random() * 4,
        size: 1.5 + Math.random() * 2.2,
        color: 'rgba(215, 232, 255, 0.55)',
        kind: 'dust',
      });
    }
  }

  public spawnParticle(cfg: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
    color: string;
    kind: Particle['kind'];
  }): void {
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = cfg.x;
        p.y = cfg.y;
        p.vx = cfg.vx;
        p.vy = cfg.vy;
        p.life = cfg.life;
        p.maxLife = cfg.life;
        p.size = cfg.size;
        p.color = cfg.color;
        p.kind = cfg.kind;
        return;
      }
    }
  }

  public spawnText(x: number, y: number, text: string, color: string, scale = 1): void {
    for (const ft of this.texts) {
      if (!ft.active) {
        ft.active = true;
        ft.x = x;
        ft.y = y;
        ft.vy = -44;
        ft.life = 1.25;
        ft.maxLife = 1.25;
        ft.text = text;
        ft.color = color;
        ft.scale = scale;
        return;
      }
    }
  }

  public update(sim: GameSimulation, dt: number): void {
    // Emit ambient dust motes
    this.dustTimer += dt;
    if (this.dustTimer >= 0.42) {
      this.dustTimer = 0;
      this.spawnParticle({
        x: 85 + Math.random() * 340,
        y: 135 + Math.random() * 420,
        vx: 6 + Math.random() * 9,
        vy: -5 + Math.random() * 8,
        life: 4.5,
        size: 1.5 + Math.random() * 2,
        color: 'rgba(210, 230, 255, 0.45)',
        kind: 'dust',
      });
    }

    // Emit gentle Zzz particles while sleeping peacefully
    if (sim.sleeper.mood === 'sleeping' && sim.subPhase === 'sleep') {
      this.zzzTimer += dt;
      if (this.zzzTimer >= 1.15) {
        this.zzzTimer = 0;
        this.spawnParticle({
          x: 892 + (Math.random() - 0.5) * 14,
          y: 356,
          vx: 10 + Math.random() * 8,
          vy: -28 - Math.random() * 10,
          life: 2.1,
          size: 15,
          color: 'rgba(214, 228, 255, 0.65)',
          kind: 'zzz',
        });
      }
    }

    // Emit comedy fever sweat beads
    if (
      sim.sleeper.activeConditions.includes('dramatic_fever') &&
      sim.subPhase === 'sleep'
    ) {
      this.feverSweatTimer += dt;
      if (this.feverSweatTimer >= 0.55) {
        this.feverSweatTimer = 0;
        this.spawnParticle({
          x: 878 + (Math.random() - 0.5) * 34,
          y: 375,
          vx: (Math.random() - 0.5) * 28,
          vy: -45 - Math.random() * 25,
          life: 0.6,
          size: 3.2,
          color: '#8ce2ff',
          kind: 'sweat',
        });
      }
    }

    // Dash wind trail
    if (sim.mosquito.mood === 'dash') {
      this.spawnParticle({
        x: sim.mosquito.x - sim.mosquito.vx * 0.02,
        y: sim.mosquito.y + (Math.random() - 0.5) * 10,
        vx: -sim.mosquito.vx * 0.15,
        vy: (Math.random() - 0.5) * 20,
        life: 0.24,
        size: 3,
        color: hasUpgrade(sim, 'emergency_dash')
          ? 'rgba(180, 255, 130, 0.7)'
          : 'rgba(220, 244, 255, 0.55)',
        kind: 'wind',
      });
    }

    // Handle discrete simulation events
    for (const ev of sim.eventsThisStep) {
      switch (ev.type) {
        case 'dash':
          for (let i = 0; i < 6; i++) {
            this.spawnParticle({
              x: sim.mosquito.x,
              y: sim.mosquito.y,
              vx: -sim.mosquito.vx * 0.2 + (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              life: 0.28,
              size: 2.6,
              color: '#d8f3ff',
              kind: 'wind',
            });
          }
          break;
        case 'sip_tick':
          for (let i = 0; i < 3; i++) {
            this.spawnParticle({
              x: ev.x + (Math.random() - 0.5) * 8,
              y: ev.y + 8,
              vx: (Math.random() - 0.5) * 35,
              vy: -30 - Math.random() * 35,
              life: 0.45,
              size: 3.2,
              color: '#ff5d6c',
              kind: 'blood',
            });
          }
          break;
        case 'food_sip':
          for (let i = 0; i < 3; i++) {
            this.spawnParticle({
              x: ev.x + (Math.random() - 0.5) * 10,
              y: ev.y + 6,
              vx: (Math.random() - 0.5) * 32,
              vy: -28 - Math.random() * 32,
              life: 0.45,
              size: 3.1,
              color: '#ffbe5c',
              kind: 'juice',
            });
          }
          break;
        case 'long_distance':
          this.spawnText(ev.x, ev.y, `LONG-DISTANCE +${ev.bonus}!`, '#ffd166', 1.05);
          for (let i = 0; i < 10; i++) {
            const ang = (Math.PI * 2 * i) / 10;
            this.spawnParticle({
              x: ev.x,
              y: ev.y + 18,
              vx: Math.cos(ang) * 95,
              vy: Math.sin(ang) * 95,
              life: 0.5,
              size: 3.5,
              color: '#ffd166',
              kind: 'spark',
            });
          }
          break;
        case 'near_miss':
          this.spawnText(
            ev.x,
            ev.y,
            ev.streak > 1 ? `NEAR MISS x${ev.streak}! +${ev.bonus}` : `NEAR MISS! +${ev.bonus}`,
            '#ffcf5c',
            1.22
          );
          for (let i = 0; i < 18; i++) {
            const ang = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.25;
            const isWingBurst = i % 2 === 0;
            const spd = isWingBurst ? 130 + Math.random() * 140 : 70 + Math.random() * 110;
            this.spawnParticle({
              x: sim.mosquito.x,
              y: sim.mosquito.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: isWingBurst ? 0.34 : 0.5 + Math.random() * 0.18,
              size: isWingBurst ? 3.2 : 3.5,
              color: isWingBurst ? '#dff6ff' : i % 3 === 0 ? '#9be7ff' : '#ffd166',
              kind: isWingBurst ? 'wind' : i % 3 === 0 ? 'sweat' : 'spark',
            });
          }
          break;
        case 'alarm_tick':
          if (ev.urgency > 0.3) {
            this.spawnParticle({
              x: 1064 + (Math.random() - 0.5) * 14,
              y: 422,
              vx: (Math.random() - 0.5) * 18,
              vy: -32,
              life: 0.55,
              size: 12,
              color: ev.urgency > 0.7 ? '#ff6b6b' : '#ffcf78',
              kind: 'note',
            });
          }
          break;
        case 'alarm_ring':
          this.spawnText(1064, 405, 'RIIIING!!', '#ff6b6b', 1.35);
          for (let i = 0; i < 16; i++) {
            const ang = (Math.PI * 2 * i) / 16;
            this.spawnParticle({
              x: 1064,
              y: 446,
              vx: Math.cos(ang) * 130,
              vy: Math.sin(ang) * 130,
              life: 0.55,
              size: 4,
              color: i % 2 === 0 ? '#ff6b6b' : '#ffe66d',
              kind: 'spark',
            });
          }
          break;
        case 'scratch_flick':
          this.spawnText(ev.x, ev.y, 'SCRATCH FLICK!', '#ffb378', 1.05);
          for (let i = 0; i < 8; i++) {
            this.spawnParticle({
              x: ev.x,
              y: ev.y + 12,
              vx: (Math.random() - 0.5) * 140,
              vy: -40 - Math.random() * 80,
              life: 0.35,
              size: 3,
              color: '#ffe0bd',
              kind: 'spark',
            });
          }
          break;
        case 'bloated':
          this.spawnText(ev.x, ev.y, 'SO CHONKY!', '#ff8fa3', 1.15);
          break;
        case 'condition_triggered': {
          const meta = COMEDY_CONDITIONS[ev.condition];
          this.spawnText(ev.x, ev.y, meta.label.toUpperCase() + '!', '#ffbe5c', 0.95);
          break;
        }
        case 'sneeze_blast':
          this.spawnText(ev.x - 40, ev.y - 28, 'ACHOO!!', '#9be7ff', 1.4);
          for (let i = 0; i < 24; i++) {
            this.spawnParticle({
              x: ev.x,
              y: ev.y + (Math.random() - 0.5) * 28,
              vx: -260 - Math.random() * 380,
              vy: (Math.random() - 0.5) * 150,
              life: 0.48,
              size: 3.6,
              color: i % 2 === 0 ? '#d8f4ff' : '#9be7ff',
              kind: 'wind',
            });
          }
          break;
        case 'achievement':
          this.spawnText(sim.mosquito.x, sim.mosquito.y - 42, `★ ${ev.title}!`, '#a6e22e', 1.12);
          break;
        case 'swatted':
          this.spawnText(ev.x, ev.y - 24, 'SPLAT!', '#ff5a5f', 1.35);
          for (let i = 0; i < 20; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 190;
            this.spawnParticle({
              x: ev.x,
              y: ev.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 0.55,
              size: 4,
              color: i % 2 === 0 ? '#ff6b6b' : '#ffe66d',
              kind: 'spark',
            });
          }
          break;
        case 'pillow_slap':
          for (let i = 0; i < 12; i++) {
            const ang = -Math.PI + Math.random() * Math.PI;
            const spd = 55 + Math.random() * 115;
            this.spawnParticle({
              x: ev.x + (Math.random() - 0.5) * 32,
              y: ev.y + (Math.random() - 0.5) * 16,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 25,
              life: 0.95 + Math.random() * 0.45,
              size: 5 + Math.random() * 3.5,
              color: i % 3 === 0 ? '#fff6e8' : '#ffffff',
              kind: 'feather',
            });
          }
          break;
      }
    }

    // Update particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'zzz') {
        p.x += Math.sin(p.life * 4) * 12 * dt;
      } else if (p.kind === 'sweat') {
        p.vy += 240 * dt;
      } else if (p.kind === 'feather') {
        p.vx *= Math.pow(0.25, dt);
        p.vy += 38 * dt;
        p.x += Math.sin(p.life * 7) * 28 * dt;
      }
    }

    // Update floating texts
    for (const ft of this.texts) {
      if (!ft.active) continue;
      ft.life -= dt;
      if (ft.life <= 0) {
        ft.active = false;
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= Math.pow(0.25, dt);
    }
  }
}

export function computeCameraTransform(
  viewportWidth: number,
  viewportHeight: number,
  mosquitoX: number,
  phase: GameSimulation['phase'] = 'playing'
): CameraTransform {
  const scale = Math.max(viewportWidth / WORLD_WIDTH, viewportHeight / WORLD_HEIGHT);
  const visibleWorldW = viewportWidth / scale;
  const visibleWorldH = viewportHeight / scale;

  let offsetX = 0;
  if (visibleWorldW < WORLD_WIDTH) {
    const focusX = phase === 'title' ? 790 : mosquitoX;
    const desiredLeft = focusX - visibleWorldW * 0.45;
    const maxLeft = WORLD_WIDTH - visibleWorldW;
    offsetX = -clamp(desiredLeft, 0, maxLeft) * scale;
  } else {
    offsetX = (viewportWidth - WORLD_WIDTH * scale) * 0.5;
  }

  let offsetY = 0;
  if (visibleWorldH < WORLD_HEIGHT) {
    offsetY = -(WORLD_HEIGHT - visibleWorldH) * 0.48 * scale;
  } else {
    offsetY = (viewportHeight - WORLD_HEIGHT * scale) * 0.5;
  }

  return { scale, offsetX, offsetY };
}

export function screenToWorldPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cam: CameraTransform
): { x: number; y: number } {
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: (localX - cam.offsetX) / cam.scale,
    y: (localY - cam.offsetY) / cam.scale,
  };
}

let cachedStaticCanvas: HTMLCanvasElement | null = null;

function getStaticRoomLayer(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedStaticCanvas) return cachedStaticCanvas;

  const offscreen = document.createElement('canvas');
  offscreen.width = WORLD_WIDTH;
  offscreen.height = WORLD_HEIGHT;
  const octx = offscreen.getContext('2d');
  if (!octx) return null;

  drawStaticRoomArchitecture(octx);
  drawStaticWallDecor(octx);
  drawStaticNightstandAndLampBase(octx);
  drawStaticBedFrame(octx);
  cachedStaticCanvas = offscreen;
  return cachedStaticCanvas;
}

let cachedLightsOnCanvas: HTMLCanvasElement | null = null;
function getLightsOnOverlay(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedLightsOnCanvas) return cachedLightsOnCanvas;
  const off = document.createElement('canvas');
  off.width = WORLD_WIDTH;
  off.height = WORLD_HEIGHT;
  const lctx = off.getContext('2d');
  if (!lctx) return null;
  const ceilingGlow = lctx.createRadialGradient(660, 120, 40, 660, 320, 780);
  ceilingGlow.addColorStop(0, 'rgba(255, 244, 206, 0.36)');
  ceilingGlow.addColorStop(0.55, 'rgba(255, 224, 165, 0.22)');
  ceilingGlow.addColorStop(1, 'rgba(255, 200, 130, 0.10)');
  lctx.fillStyle = ceilingGlow;
  lctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  cachedLightsOnCanvas = off;
  return cachedLightsOnCanvas;
}

let cachedVignetteCanvas: HTMLCanvasElement | null = null;
function getVignetteLayer(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedVignetteCanvas) return cachedVignetteCanvas;
  const off = document.createElement('canvas');
  off.width = WORLD_WIDTH;
  off.height = WORLD_HEIGHT;
  const vctx = off.getContext('2d');
  if (!vctx) return null;
  const vig = vctx.createRadialGradient(
    WORLD_WIDTH * 0.5,
    WORLD_HEIGHT * 0.48,
    380,
    WORLD_WIDTH * 0.5,
    WORLD_HEIGHT * 0.5,
    820
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(5, 7, 15, 0.45)');
  vctx.fillStyle = vig;
  vctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  cachedVignetteCanvas = off;
  return cachedVignetteCanvas;
}

let cachedMoonCanvas: HTMLCanvasElement | null = null;
function getCrescentMoonStamp(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedMoonCanvas) return cachedMoonCanvas;
  const off = document.createElement('canvas');
  off.width = 64;
  off.height = 64;
  const mctx = off.getContext('2d');
  if (!mctx) return null;
  mctx.fillStyle = '#eef4ff';
  mctx.beginPath();
  mctx.arc(32, 32, 23, 0, Math.PI * 2);
  mctx.fill();
  mctx.globalCompositeOperation = 'destination-out';
  mctx.beginPath();
  mctx.arc(41, 26, 20, 0, Math.PI * 2);
  mctx.fill();
  mctx.globalCompositeOperation = 'source-over';
  cachedMoonCanvas = off;
  return cachedMoonCanvas;
}

export function renderBedroomGame(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  effects: EffectsPool,
  viewportWidth: number,
  viewportHeight: number,
  timeSec: number
): CameraTransform {
  const cam = computeCameraTransform(viewportWidth, viewportHeight, sim.mosquito.x, sim.phase);

  ctx.save();
  ctx.fillStyle = '#0d1120';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Apply decaying squared trauma screen shake
  const shakeMag = sim.shakeTrauma * sim.shakeTrauma * 18;
  const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

  ctx.translate(cam.offsetX + shakeX, cam.offsetY + shakeY);
  ctx.scale(cam.scale, cam.scale);

  // 1. Cached Static Bedroom Wall, Wainscoting, Floor, Wall Decor, Nightstand & Bedframe
  const staticLayer = getStaticRoomLayer();
  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0);
  } else {
    drawStaticRoomArchitecture(ctx);
    drawStaticWallDecor(ctx);
    drawStaticNightstandAndLampBase(ctx);
    drawStaticBedFrame(ctx);
  }
  drawDynamicRoomLighting(ctx, sim, timeSec);

  // 2. Moonlit Window, Night Sky, Drapes & Volumetric Moonlight (+ Escape Portal during Wake-Up!)
  drawWindowAndMoonlight(ctx, sim, timeSec);

  // 3. Dynamic Wall Mobile Charm
  drawDynamicWallCharm(ctx, timeSec);

  // 4. Dynamic Vibrating Alarm Clock & Warm Lamp Rim
  drawDynamicNightstandDetails(ctx, sim, timeSec);

  // 5. Pillows, Quilted Blanket & Sleeping/Hunting Human (plus Comedy Status Visuals)
  drawBedAndSleeper(ctx, sim, timeSec);

  // 6. Alternative Bedroom Food Sources (Juice Glass, Apple Scrap, Sweet Spill)
  drawFoodSources(ctx, sim, timeSec);

  // 7. Sip Target Subtle Pulsing Cues & Scratch Warnings
  if (sim.phase === 'playing' && sim.subPhase === 'sleep') {
    drawSipTargets(ctx, sim, timeSec);
  }

  // 8. Swat Windup Telegraph & Unified Articulated IK Arm/Hand
  drawSleeperArmAndSwat(ctx, sim, timeSec);

  // 9. Mosquito Shadow & Expressive Character (with bloat & evolution gear!)
  if (sim.phase !== 'title') {
    drawMosquitoShadow(ctx, sim);
    drawMosquito(ctx, sim, timeSec);
  }

  // 10. Atmospheric Particles & Floating Score Popups
  drawParticlesAndTexts(ctx, effects);

  // 11. Foreground Framing Silhouettes (Fern & Bed Corner)
  drawForegroundSilhouettes(ctx, timeSec);

  // 12. Subtle Slow-Mo / Tension / Lights-On Vignette
  drawAtmosphericVignette(ctx, sim);

  ctx.restore();

  // 13. Off-screen directional cue on narrow mobile screens
  if (sim.phase === 'playing') {
    const visibleLeft = -cam.offsetX / cam.scale;
    const visibleRight = visibleLeft + viewportWidth / cam.scale;
    if (sim.subPhase === 'escape' && visibleLeft > WINDOW_ESCAPE_ZONE.x + 60) {
      drawEdgeCue(ctx, 22, viewportHeight * 0.45, -1);
    } else if (sim.subPhase === 'sleep') {
      if (visibleRight < 490) {
        drawEdgeCue(ctx, viewportWidth - 22, viewportHeight * 0.54, 1);
      } else if (visibleLeft > 880) {
        drawEdgeCue(ctx, 22, viewportHeight * 0.54, -1);
      }
    }
  }

  return cam;
}

function drawEdgeCue(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 1 | -1
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255, 190, 92, 0.85)';
  ctx.strokeStyle = '#14182a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(dir * 10, 0);
  ctx.lineTo(-dir * 8, -10);
  ctx.lineTo(-dir * 4, 0);
  ctx.lineTo(-dir * 8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStaticRoomArchitecture(ctx: CanvasRenderingContext2D): void {
  const wallGrad = ctx.createLinearGradient(0, 0, 0, 700);
  wallGrad.addColorStop(0, '#141930');
  wallGrad.addColorStop(0.55, '#1d2440');
  wallGrad.addColorStop(1, '#1a1f36');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, WORLD_WIDTH, 705);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
  for (let x = 20; x < WORLD_WIDTH; x += 64) {
    ctx.fillRect(x, 0, 24, 575);
  }

  ctx.fillStyle = '#151a2e';
  ctx.fillRect(0, 575, WORLD_WIDTH, 130);
  ctx.fillStyle = '#29314f';
  ctx.fillRect(0, 570, WORLD_WIDTH, 9);
  ctx.fillStyle = '#0e1120';
  ctx.fillRect(0, 579, WORLD_WIDTH, 3);

  for (let x = 24; x < WORLD_WIDTH - 40; x += 156) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, 594, 128, 92);
  }

  const floorGrad = ctx.createLinearGradient(0, 700, 0, WORLD_HEIGHT);
  floorGrad.addColorStop(0, '#291c1a');
  floorGrad.addColorStop(1, '#181010');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 700, WORLD_WIDTH, WORLD_HEIGHT - 700);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 700);
  ctx.lineTo(WORLD_WIDTH, 700);
  for (let i = 0; i <= 10; i++) {
    const topX = i * 135;
    const botX = (topX - WORLD_WIDTH * 0.5) * 1.25 + WORLD_WIDTH * 0.5;
    ctx.moveTo(topX, 700);
    ctx.lineTo(botX, WORLD_HEIGHT);
  }
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = '#3b2b3d';
  ctx.beginPath();
  ctx.ellipse(665, 748, 310, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235, 198, 150, 0.22)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const lampGlow = ctx.createRadialGradient(1108, 345, 18, 1080, 370, 440);
  lampGlow.addColorStop(0, 'rgba(255, 192, 92, 0.38)');
  lampGlow.addColorStop(0.32, 'rgba(255, 160, 72, 0.16)');
  lampGlow.addColorStop(0.7, 'rgba(255, 140, 60, 0.05)');
  lampGlow.addColorStop(1, 'rgba(255, 140, 60, 0)');
  ctx.fillStyle = lampGlow;
  ctx.fillRect(580, 0, 700, WORLD_HEIGHT);
}

function drawDynamicRoomLighting(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  _timeSec: number
): void {
  if (sim.lightsOn) {
    const litLayer = getLightsOnOverlay();
    if (litLayer) {
      ctx.drawImage(litLayer, 0, 0);
    }
    return;
  }

  // Subtle dawn glow creeping in as alarm approaches
  if (sim.phase === 'playing' && sim.timeRemaining < 12) {
    const dawnAlpha = clamp((12 - sim.timeRemaining) / 12, 0, 1) * 0.18;
    const dawnGrad = ctx.createLinearGradient(0, 80, 500, 500);
    dawnGrad.addColorStop(0, `rgba(255, 166, 130, ${dawnAlpha})`);
    dawnGrad.addColorStop(1, 'rgba(255, 166, 130, 0)');
    ctx.fillStyle = dawnGrad;
    ctx.fillRect(0, 0, 750, WORLD_HEIGHT);
  }
}

function drawWindowAndMoonlight(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const wx = 84;
  const wy = 104;
  const ww = 228;
  const wh = 330;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, wx - 10, wy - 8, ww + 24, wh + 26, 8);
  ctx.fill();

  ctx.save();
  roundRect(ctx, wx, wy, ww, wh, 6);
  ctx.clip();

  const dawnBlend =
    sim.phase === 'playing' && (sim.subPhase === 'escape' || sim.timeRemaining < 14)
      ? sim.subPhase === 'escape'
        ? 0.9
        : clamp((14 - sim.timeRemaining) / 14, 0, 1)
      : 0;
  const skyGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  skyGrad.addColorStop(0, dawnBlend > 0.3 ? '#26346e' : '#090e20');
  skyGrad.addColorStop(0.65, dawnBlend > 0.2 ? '#4d4172' : '#121b38');
  skyGrad.addColorStop(1, dawnBlend > 0.1 ? '#9d687b' : '#1b284d');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(wx, wy, ww, wh);

  const stars = [
    [118, 145, 1.5],
    [158, 188, 1.2],
    [262, 135, 1.7],
    [280, 222, 1.3],
    [136, 268, 1.4],
    [212, 140, 1.1],
    [194, 240, 1.5],
  ];
  for (let i = 0; i < stars.length; i++) {
    const [sx, sy, sr] = stars[i];
    const alpha = 0.45 + 0.45 * Math.sin(timeSec * 2.2 + i * 1.7);
    ctx.fillStyle = `rgba(235, 244, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const moonX = wx + 158;
  const moonY = wy + 82;
  const moonHalo = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 72);
  moonHalo.addColorStop(0, 'rgba(215, 232, 255, 0.36)');
  moonHalo.addColorStop(1, 'rgba(215, 232, 255, 0)');
  ctx.fillStyle = moonHalo;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 72, 0, Math.PI * 2);
  ctx.fill();

  const crescent = getCrescentMoonStamp();
  if (crescent) {
    ctx.drawImage(crescent, moonX - 32, moonY - 32);
  }

  const cloudOffset = ((timeSec * 8) % 280) - 40;
  ctx.fillStyle = 'rgba(130, 155, 205, 0.14)';
  ctx.beginPath();
  ctx.ellipse(wx + cloudOffset, wy + 138, 46, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(wx + cloudOffset + 25, wy + 132, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#090c1a';
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh);
  ctx.lineTo(wx, wy + 255);
  ctx.lineTo(wx + 48, wy + 235);
  ctx.lineTo(wx + 92, wy + 260);
  ctx.lineTo(wx + 92, wy + 242);
  ctx.lineTo(wx + 148, wy + 242);
  ctx.lineTo(wx + 178, wy + 225);
  ctx.lineTo(wx + ww, wy + 255);
  ctx.lineTo(wx + ww, wy + wh);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Window mullions & wooden frame
  ctx.strokeStyle = '#333b5c';
  ctx.lineWidth = 10;
  roundRect(ctx, wx, wy, ww, wh, 4);
  ctx.stroke();

  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(wx + ww * 0.5, wy);
  ctx.lineTo(wx + ww * 0.5, wy + wh);
  ctx.moveTo(wx, wy + wh * 0.48);
  ctx.lineTo(wx + ww, wy + wh * 0.48);
  ctx.stroke();

  // Window sill
  ctx.fillStyle = '#3b4466';
  roundRect(ctx, wx - 16, wy + wh - 2, ww + 32, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#4e5982';
  ctx.fillRect(wx - 14, wy + wh - 2, ww + 28, 4);

  // Small potted plant on window sill
  ctx.save();
  ctx.translate(wx + 42, wy + wh - 2);
  ctx.fillStyle = '#a85a46';
  ctx.beginPath();
  ctx.moveTo(-14, -24);
  ctx.lineTo(14, -24);
  ctx.lineTo(10, 0);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4f7a5a';
  const leafSway = Math.sin(timeSec * 1.4) * 0.08;
  for (let i = -1; i <= 1; i++) {
    ctx.save();
    ctx.translate(i * 5, -24);
    ctx.rotate(i * 0.35 + leafSway);
    ctx.beginPath();
    ctx.ellipse(0, -14, 5, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Escape portal ring when alarm rings & lights turn ON!
  if (sim.phase === 'playing' && sim.subPhase === 'escape') {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 7);
    ctx.save();
    ctx.translate(WINDOW_ESCAPE_ZONE.x, WINDOW_ESCAPE_ZONE.y);
    ctx.fillStyle = `rgba(136, 212, 184, ${0.14 + pulse * 0.14})`;
    ctx.beginPath();
    ctx.arc(0, 0, WINDOW_ESCAPE_ZONE.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -timeSec * 36;
    ctx.strokeStyle = '#88f2c8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, WINDOW_ESCAPE_ZONE.radius - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#141b2e';
    roundRect(ctx, -46, -16, 92, 30, 12);
    ctx.fill();
    ctx.strokeStyle = '#88f2c8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a8ffe0';
    ctx.font = '800 13px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ESCAPE!', 0, -1);
    ctx.restore();
  }

  // Volumetric moonlight shaft falling across bedroom
  ctx.save();
  const beamGrad = ctx.createLinearGradient(wx + 40, wy + 20, wx + 460, 740);
  beamGrad.addColorStop(0, 'rgba(182, 212, 255, 0.14)');
  beamGrad.addColorStop(0.55, 'rgba(162, 198, 255, 0.06)');
  beamGrad.addColorStop(1, 'rgba(162, 198, 255, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(wx + 8, wy + 8);
  ctx.lineTo(wx + ww - 8, wy + 8);
  ctx.lineTo(wx + ww + 290, 755);
  ctx.lineTo(wx + 70, 755);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Curtain rod & gently swaying curtains
  ctx.fillStyle = '#4b3630';
  roundRect(ctx, wx - 36, wy - 20, ww + 72, 8, 4);
  ctx.fill();

  const sway = Math.sin(timeSec * 1.25) * 8;
  drawCurtain(ctx, wx - 28, wy - 14, 56, wh + 86, sway, false);
  drawCurtain(ctx, wx + ww - 28, wy - 14, 56, wh + 86, sway * 0.7, true);
}

function drawCurtain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sway: number,
  flip: boolean
): void {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, '#2a3352');
  grad.addColorStop(0.5, '#3b4870');
  grad.addColorStop(1, '#232b46');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.quadraticCurveTo(
    x + w + (flip ? -6 : 10) + sway * 0.6,
    y + h * 0.55,
    x + w + sway,
    y + h
  );
  ctx.lineTo(x + sway * 0.8, y + h);
  ctx.quadraticCurveTo(x + sway * 0.4, y + h * 0.5, x, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(180, 205, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + 8);
  ctx.quadraticCurveTo(
    x + w * 0.35 + sway * 0.5,
    y + h * 0.5,
    x + w * 0.35 + sway * 0.85,
    y + h - 4
  );
  ctx.stroke();
  ctx.restore();
}

function drawStaticWallDecor(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(1092, 165);
  ctx.rotate(0.02);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  roundRect(ctx, -58, -42, 122, 92, 4);
  ctx.fill();

  ctx.fillStyle = '#5a3d31';
  roundRect(ctx, -62, -46, 124, 92, 4);
  ctx.fill();

  ctx.fillStyle = '#d9ccb4';
  ctx.fillRect(-52, -36, 104, 72);

  ctx.fillStyle = '#2b3c5e';
  ctx.fillRect(-48, -32, 96, 64);
  ctx.fillStyle = '#47686b';
  ctx.beginPath();
  ctx.moveTo(-48, 32);
  ctx.quadraticCurveTo(-10, -2, 48, 22);
  ctx.lineTo(48, 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2deb0';
  ctx.beginPath();
  ctx.arc(20, -14, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(806, 206, 186, 10);
  ctx.fillStyle = '#5b3c31';
  roundRect(ctx, 802, 196, 190, 12, 3);
  ctx.fill();

  const books = [
    { x: 816, w: 16, h: 48, c: '#7a4b5a' },
    { x: 834, w: 14, h: 42, c: '#486a73' },
    { x: 850, w: 18, h: 52, c: '#c48d4c' },
  ];
  for (const b of books) {
    ctx.fillStyle = b.c;
    roundRect(ctx, b.x, 196 - b.h, b.w, b.h, 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDynamicWallCharm(ctx: CanvasRenderingContext2D, timeSec: number): void {
  const charmSway = Math.sin(timeSec * 0.9) * 0.09;
  ctx.save();
  ctx.translate(945, 208);
  ctx.rotate(charmSway);
  ctx.strokeStyle = 'rgba(220, 230, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 26);
  ctx.stroke();
  ctx.fillStyle = '#b4c6e7';
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(9, 36);
  ctx.lineTo(0, 44);
  ctx.lineTo(-9, 36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStaticNightstandAndLampBase(ctx: CanvasRenderingContext2D): void {
  const nx = 1030;
  const ny = 478;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(nx + 76, 704, 88, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3f2822';
  roundRect(ctx, nx, ny, 152, 222, 6);
  ctx.fill();

  ctx.fillStyle = '#5b3a30';
  roundRect(ctx, nx - 8, ny - 10, 168, 16, 4);
  ctx.fill();

  ctx.fillStyle = '#4d3129';
  roundRect(ctx, nx + 14, ny + 22, 124, 58, 4);
  ctx.fill();
  roundRect(ctx, nx + 14, ny + 94, 124, 68, 4);
  ctx.fill();

  ctx.fillStyle = '#d9b26f';
  ctx.beginPath();
  ctx.arc(nx + 76, ny + 51, 5, 0, Math.PI * 2);
  ctx.arc(nx + 76, ny + 128, 5, 0, Math.PI * 2);
  ctx.fill();

  // Bedside Lamp (alarm clock is now drawn dynamically so it can shake & ring!)
  const lx = nx + 102;
  const ly = ny - 10;

  ctx.fillStyle = '#c8bca7';
  ctx.beginPath();
  ctx.moveTo(lx - 18, ly);
  ctx.quadraticCurveTo(lx - 14, ly - 48, lx, ly - 58);
  ctx.quadraticCurveTo(lx + 14, ly - 48, lx + 18, ly);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#d4aa63';
  ctx.fillRect(lx - 3, ly - 88, 6, 34);

  const coneGrad = ctx.createLinearGradient(lx, ly - 100, lx - 40, ly + 180);
  coneGrad.addColorStop(0, 'rgba(255, 206, 118, 0.28)');
  coneGrad.addColorStop(1, 'rgba(255, 180, 90, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(lx - 42, ly - 82);
  ctx.lineTo(lx + 42, ly - 82);
  ctx.lineTo(lx + 115, ly + 170);
  ctx.lineTo(lx - 150, ly + 170);
  ctx.closePath();
  ctx.fill();

  const shadeGrad = ctx.createLinearGradient(lx, ly - 146, lx, ly - 82);
  shadeGrad.addColorStop(0, '#f3d79e');
  shadeGrad.addColorStop(1, '#ffbc5e');
  ctx.fillStyle = shadeGrad;
  ctx.beginPath();
  ctx.moveTo(lx - 26, ly - 144);
  ctx.lineTo(lx + 26, ly - 144);
  ctx.lineTo(lx + 44, ly - 82);
  ctx.lineTo(lx - 44, ly - 82);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#633c26';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(130, 74, 34, 0.25)';
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(lx + i * 9, ly - 144);
    ctx.lineTo(lx + i * 14, ly - 82);
    ctx.stroke();
  }
}

function drawDynamicNightstandDetails(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const nx = 1030;
  const ny = 478;
  const cx = nx + 34;
  const cy = ny - 32;
  const lx = nx + 102;
  const ly = ny - 10;

  // Dynamic Animated Retro Twin-Bell Alarm Clock!
  const urgency =
    sim.subPhase === 'escape'
      ? 1
      : sim.phase === 'playing' && sim.timeRemaining < 15
        ? clamp((15 - sim.timeRemaining) / 15, 0, 1)
        : 0;
  const shakeAmt =
    sim.subPhase === 'escape'
      ? 3.8
      : urgency > 0.35
        ? urgency * 2.2
        : 0;
  const clockShakeX = shakeAmt > 0 ? Math.sin(timeSec * 46) * shakeAmt : 0;
  const clockShakeY = shakeAmt > 0 ? Math.cos(timeSec * 52) * shakeAmt * 0.5 : 0;
  const clockTilt = shakeAmt > 0 ? Math.sin(timeSec * 38) * 0.14 * (0.4 + urgency) : 0;

  ctx.save();
  ctx.translate(cx + clockShakeX, cy + clockShakeY);
  ctx.rotate(clockTilt);

  // Sound wave arcs when alarm is urgent or ringing!
  if (sim.subPhase === 'escape' || urgency > 0.55) {
    const waveAlpha = sim.subPhase === 'escape' ? 0.85 : urgency * 0.55;
    ctx.strokeStyle = `rgba(255, 118, 96, ${waveAlpha})`;
    ctx.lineWidth = 2.2;
    const wavePulse = (timeSec * 4) % 1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 16, -12, 12 + wavePulse * 12, side > 0 ? -0.9 : Math.PI - 0.5, side > 0 ? 0.5 : Math.PI + 0.9);
      ctx.stroke();
    }
  }

  // Twin bells & hammer
  ctx.fillStyle = urgency > 0.6 ? '#c94c4c' : '#8b4145';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-13, -16, 7.5, 0, Math.PI * 2);
  ctx.arc(13, -16, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Clock body
  ctx.fillStyle = urgency > 0.6 ? '#db5a5e' : '#a44e52';
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Clock face (blushes amber/coral near zero!)
  ctx.fillStyle =
    sim.subPhase === 'escape' && Math.floor(timeSec * 8) % 2 === 0
      ? '#ffd0c7'
      : urgency > 0.7
        ? '#ffe5cf'
        : '#f6eedc';
  ctx.beginPath();
  ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
  ctx.fill();

  // Clock hands synced with alarm duration!
  const denom = Math.max(1, sim.alarmDuration);
  const progress = 1 - clamp(sim.timeRemaining / denom, 0, 1);
  const handAngle = -Math.PI * 0.5 + progress * Math.PI * 2;
  ctx.strokeStyle = '#2c2529';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(handAngle) * 9.5, Math.sin(handAngle) * 9.5);
  ctx.moveTo(0, 0);
  ctx.lineTo(5, -3);
  ctx.stroke();
  ctx.restore();

  // Warm lamp rim glow
  ctx.fillStyle = `rgba(255, 224, 150, ${0.4 + Math.sin(timeSec * 4) * 0.08})`;
  ctx.beginPath();
  ctx.ellipse(lx, ly - 82, 26, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStaticBedFrame(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(675, 706, 355, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#472c26';
  roundRect(ctx, 932, 304, 62, 396, 10);
  ctx.fill();
  ctx.fillStyle = '#5e3b33';
  roundRect(ctx, 940, 314, 24, 220, 6);
  ctx.fill();
  ctx.fillStyle = '#6e473d';
  ctx.beginPath();
  ctx.arc(963, 298, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#472c26';
  roundRect(ctx, 352, 434, 44, 266, 9);
  ctx.fill();
  ctx.fillStyle = '#6e473d';
  ctx.beginPath();
  ctx.arc(374, 428, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#55352d';
  roundRect(ctx, 366, 562, 608, 72, 8);
  ctx.fill();
  ctx.fillStyle = '#38211c';
  ctx.fillRect(374, 625, 24, 76);
  ctx.fillRect(942, 625, 24, 76);

  ctx.fillStyle = '#ded4c8';
  roundRect(ctx, 386, 495, 558, 80, 14);
  ctx.fill();
}

function drawBedAndSleeper(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const s = sim.sleeper;
  const pose = computeHumanPose(sim);
  const hasFever = s.activeConditions.includes('dramatic_fever');
  const sitUp = sim.subPhase === 'escape' ? clamp(s.sitUpAmount, 0, 1) : 0;

  // 1. Dynamic Plush Pillow (compresses smoothly under head weight or pillow_slap!)
  ctx.save();
  ctx.translate(pose.pillowX, pose.pillowY);
  ctx.rotate(-0.08 + pose.pillowSquash * 0.04);
  const pScaleX = 1 + pose.pillowSquash * 0.12;
  const pScaleY = 1 - pose.pillowSquash * 0.24;
  ctx.scale(pScaleX, pScaleY);

  // Pillow drop shadow on mattress
  ctx.fillStyle = 'rgba(28, 22, 34, 0.22)';
  roundRect(ctx, -64, -30, 128, 66, 26);
  ctx.fill();

  const pillowGrad = ctx.createLinearGradient(0, -36, 0, 30);
  pillowGrad.addColorStop(0, '#f7efe3');
  pillowGrad.addColorStop(1, '#dfd2be');
  ctx.fillStyle = pillowGrad;
  ctx.strokeStyle = '#b9a894';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-58, -14);
  ctx.quadraticCurveTo(-64, -36, -34, -35);
  // Subtle head dent in middle-top of pillow
  ctx.quadraticCurveTo(0, -35 + pose.pillowSquash * 14, 38, -36);
  ctx.quadraticCurveTo(66, -36, 63, -8);
  ctx.quadraticCurveTo(64, 28, 34, 29);
  ctx.quadraticCurveTo(0, 31, -38, 29);
  ctx.quadraticCurveTo(-63, 28, -58, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Pillow piping crease
  ctx.strokeStyle = 'rgba(170, 152, 132, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-42, 4);
  ctx.quadraticCurveTo(0, 12 + pose.pillowSquash * 6, 44, 2);
  ctx.stroke();
  ctx.restore();

  // 2. Articulated Exposed Foot & Ankle at bottom-left of blanket (Target: 'foot')
  ctx.save();
  ctx.translate(pose.footX, pose.footY);
  ctx.rotate(pose.footAngle);

  // Skin bite glow on ankle if mosquito landed/bit there
  if (s.biteReactionTimer > 0 && s.biteReactionTargetId === 'foot') {
    const glowAlpha = clamp(s.biteReactionTimer / 0.65, 0, 1) * 0.55;
    ctx.fillStyle = `rgba(255, 86, 98, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(-4, -10, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#efb095';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(24, 5);
  ctx.quadraticCurveTo(-4, 8, -20, -2);
  ctx.quadraticCurveTo(-30, -10, -26, -24);
  ctx.quadraticCurveTo(-20, -32, -9, -27);
  ctx.quadraticCurveTo(1, -22, 6, -12);
  ctx.lineTo(27, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle ankle bone & heel shading
  ctx.fillStyle = '#df987d';
  ctx.beginPath();
  ctx.ellipse(6, -3, 6, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Articulated little toes curling with footFlex
  const toeFlex = s.footFlex * 3.5;
  ctx.fillStyle = '#f2b59a';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(-22 + i * 3.8, -25 + i * 2 + toeFlex * (1 - i * 0.15), 3.6 - i * 0.4, 2.7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 3. Back Shoulder & Back Arm (visible when torso sits up or rolls)
  if (sitUp > 0.08 || s.bodyRoll > 0.1) {
    ctx.save();
    ctx.strokeStyle = '#1b1626';
    ctx.lineWidth = 2.6;
    ctx.fillStyle = '#3c4e70';
    ctx.beginPath();
    ctx.ellipse(pose.backShoulderX, pose.backShoulderY, 24, 18, pose.torsoAngle + 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 4. Articulated Pajama Torso (anchored between pelvis & shoulder, rotating smoothly on sit-up!)
  ctx.save();
  ctx.translate(pose.pelvisX, pose.pelvisY);
  ctx.rotate(pose.torsoAngle);

  const torsoGrad = ctx.createLinearGradient(0, -34, 82, 34);
  torsoGrad.addColorStop(0, '#44577c');
  torsoGrad.addColorStop(1, '#586e99');
  ctx.fillStyle = torsoGrad;
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, -28);
  ctx.quadraticCurveTo(36, -35 - pose.breath * 1.4, 78, -26);
  ctx.quadraticCurveTo(94, -12, 92, 8);
  ctx.quadraticCurveTo(90, 30, 68, 32);
  ctx.quadraticCurveTo(30, 34, -10, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle pajama stripes & collar lapel
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  ctx.lineWidth = 2;
  for (let sy = -18; sy <= 18; sy += 12) {
    ctx.beginPath();
    ctx.moveTo(4, sy);
    ctx.lineTo(74, sy * 0.9);
    ctx.stroke();
  }
  // Collar V-trim
  ctx.fillStyle = '#d7deed';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(74, -16);
  ctx.lineTo(54, -4);
  ctx.lineTo(74, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 5. Connected Neck & Illustrated Head/Face
  // Shaded neck bridge between collar and jaw
  ctx.save();
  ctx.fillStyle = '#e4a186';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.6;
  const neckAngle = Math.atan2(pose.headY - pose.neckY, pose.headX - pose.neckX);
  ctx.translate((pose.neckX + pose.headX) * 0.5, (pose.neckY + pose.headY) * 0.5);
  ctx.rotate(neckAngle);
  roundRect(ctx, -20, -13, 38, 26, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(pose.headX, pose.headY);
  ctx.rotate(pose.headAngle);

  // Bite reaction glow on cheek if mosquito bit cheek
  if (s.biteReactionTimer > 0 && s.biteReactionTargetId === 'cheek') {
    const glowAlpha = clamp(s.biteReactionTimer / 0.65, 0, 1) * 0.55;
    ctx.fillStyle = `rgba(255, 76, 92, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(-14, 8, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sculpted head contour (softer cheek & chin profile instead of a plain ellipse)
  ctx.fillStyle = hasFever ? '#f79c8f' : '#f2b59a';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-34, -8);
  ctx.bezierCurveTo(-36, -32, -8, -38, 18, -33);
  ctx.bezierCurveTo(40, -28, 42, 4, 32, 22);
  ctx.bezierCurveTo(22, 34, -6, 36, -24, 26);
  ctx.bezierCurveTo(-35, 19, -38, 6, -34, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Warm jaw/cheek shadow
  ctx.fillStyle = 'rgba(196, 114, 90, 0.22)';
  ctx.beginPath();
  ctx.ellipse(6, 20, 22, 10, -0.1, 0, Math.PI);
  ctx.fill();

  // Rosy cheek blush (extra feverish if Dramatic Fever active!)
  ctx.fillStyle = hasFever
    ? 'rgba(255, 78, 82, 0.58)'
    : 'rgba(235, 118, 108, 0.42)';
  ctx.beginPath();
  ctx.ellipse(-12, 8, hasFever ? 15 : 11, hasFever ? 10 : 7.5, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Ear with inner fold
  ctx.fillStyle = '#e8a58b';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(23, 2, 9, 11, 0.15, -Math.PI * 0.55, Math.PI * 0.58);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(130, 68, 56, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(23, 2, 4.5, -0.6, 1.1);
  ctx.stroke();

  // Tousled messy hair with secondary bounce
  const hairBounce = Math.sin(timeSec * 12) * (s.wakeStage === 'startle' ? 2.5 : 0);
  ctx.fillStyle = '#3b2827';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-27, -21);
  ctx.quadraticCurveTo(-18, -44 + hairBounce, 4, -40);
  ctx.quadraticCurveTo(18, -48 + hairBounce, 30, -34);
  ctx.quadraticCurveTo(46, -28, 42, -5);
  ctx.quadraticCurveTo(48, 9, 32, 14);
  ctx.quadraticCurveTo(28, -12, 10, -17);
  ctx.quadraticCurveTo(-6, -15, -27, -21);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle hair highlight streak
  ctx.strokeStyle = 'rgba(145, 110, 105, 0.42)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-12, -31);
  ctx.quadraticCurveTo(8, -36, 22, -26);
  ctx.stroke();

  // Nose (wiggles gently during nose_scratch or sneeze charge!)
  const noseWiggle =
    s.sleepBehavior === 'nose_scratch'
      ? Math.sin(timeSec * 18) * 1.4
      : s.sneezeChargeTimer > 0
        ? Math.sin(timeSec * 36) * 2
        : 0;
  ctx.strokeStyle = '#995c4d';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-20, -3);
  ctx.quadraticCurveTo(-30 + noseWiggle, 3, -21, 9);
  ctx.stroke();

  // Expressive Eyes (smooth eyelid transition + pupil gaze tracking!)
  const eyePositions = [
    { cx: -14, cy: -6, rx: 7, ry: 8 },
    { cx: 4, cy: -5, rx: 7, ry: 8 },
  ];
  const openAmt = clamp(pose.eyelidOpen, 0, 1);

  for (const ep of eyePositions) {
    if (openAmt >= 0.14) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ep.cx, ep.cy, ep.rx, ep.ry * (0.28 + openAmt * 0.72), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();

      // Iris & Pupil tracking gazeX / gazeY
      const px = ep.cx + pose.gazeX * 3.1;
      const py = ep.cy + pose.gazeY * 2.8;
      ctx.fillStyle = '#4c352d';
      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15121e';
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 1, py - 1.1, 1, 0, Math.PI * 2);
      ctx.fill();

      // Upper heavy eyelid when half-open / groggy
      if (openAmt < 0.85) {
        ctx.fillStyle = '#e8a58b';
        ctx.fillRect(ep.cx - ep.rx - 2, ep.cy - ep.ry - 2, ep.rx * 2 + 4, ep.ry * (1 - openAmt) * 1.45);
      }
      ctx.restore();

      ctx.strokeStyle = '#1b1626';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(ep.cx, ep.cy, ep.rx, ep.ry * (0.28 + openAmt * 0.72), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pose.browFurrow > 0.55 || s.sneezeChargeTimer > 0) {
      // Pinched shut squint ><
      const dir = ep.cx < 0 ? 1 : -1;
      ctx.strokeStyle = '#1b1626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ep.cx - 6 * dir, ep.cy - 3);
      ctx.lineTo(ep.cx + 4 * dir, ep.cy + 1);
      ctx.lineTo(ep.cx - 6 * dir, ep.cy + 5);
      ctx.stroke();
    } else {
      // Peaceful sleeping curved lashes
      ctx.strokeStyle = '#1b1626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ep.cx, ep.cy, 6, 0.18, Math.PI - 0.18);
      ctx.stroke();
    }
  }

  // Expressive Eyebrows (furrow / surprise / confused asymmetry)
  const f = pose.browFurrow;
  const confusedAsym = pose.mouthMood === 'confused' ? -3 : 0;
  ctx.strokeStyle = '#2c1d1c';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(-22, -16 + f * 1 + confusedAsym);
  ctx.lineTo(-8, -16 + f * 5);
  ctx.moveTo(-2, -15 + f * 5);
  ctx.lineTo(12, -16 + f * 1 - confusedAsym * 0.5);
  ctx.stroke();

  // Expressive Mouth
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.4;
  if (pose.mouthMood === 'shocked') {
    ctx.fillStyle = '#752b34';
    ctx.beginPath();
    ctx.ellipse(-9, 19, 6.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (pose.mouthMood === 'angry') {
    ctx.fillStyle = '#752b34';
    ctx.beginPath();
    ctx.roundRect(-18, 14, 18, 10, 4);
    ctx.fill();
    ctx.stroke();
    // Gritted teeth glint
    ctx.fillStyle = '#fff5ea';
    ctx.fillRect(-16, 15.5, 14, 3);
  } else if (pose.mouthMood === 'confused') {
    ctx.fillStyle = '#8b454b';
    ctx.beginPath();
    ctx.ellipse(-8, 19, 4.5, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (pose.mouthMood === 'irritated' || pose.mouthMood === 'sneeze') {
    ctx.beginPath();
    ctx.moveTo(-17, 17);
    ctx.quadraticCurveTo(-11, 13, -6, 17);
    ctx.quadraticCurveTo(-1, 21, 4, 17);
    ctx.stroke();
  } else {
    const mouthOpen = Math.max(0, pose.breath) * 2.8;
    ctx.fillStyle = '#8b454b';
    ctx.beginPath();
    ctx.ellipse(-9, 18, 4.5, 2 + mouthOpen, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Comedy thermometer sticking out if Dramatic Fever is active!
  if (hasFever && sim.subPhase === 'sleep') {
    ctx.save();
    ctx.translate(-14, 17);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1b1626';
    ctx.lineWidth = 1.6;
    roundRect(ctx, -22, -3, 22, 6, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff4d5a';
    ctx.fillRect(-19, -1, 12, 2);
    ctx.beginPath();
    ctx.arc(-22, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Sneeze wind blast cone!
  if (s.sneezeBlastTimer > 0) {
    ctx.save();
    const blastGrad = ctx.createLinearGradient(-30, 6, -460, 20);
    blastGrad.addColorStop(0, 'rgba(215, 245, 255, 0.72)');
    blastGrad.addColorStop(1, 'rgba(180, 232, 255, 0)');
    ctx.fillStyle = blastGrad;
    ctx.beginPath();
    ctx.moveTo(-28, 4);
    ctx.lineTo(-470, -105);
    ctx.lineTo(-470, 130);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Sleeper mumble bubble
  if (s.mumbleTimer > 0 && s.mumbleText) {
    ctx.save();
    ctx.translate(-42, -58);
    const boxW = Math.max(88, s.mumbleText.length * 7.8 + 20);
    ctx.fillStyle = '#fff8ec';
    ctx.strokeStyle = '#1b1626';
    ctx.lineWidth = 2;
    roundRect(ctx, -boxW * 0.5, -18, boxW, 28, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b1626';
    ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.mumbleText, 0, -4);
    ctx.restore();
  }

  ctx.restore();

  // 6. Dynamic Quilted Blanket / Duvet (slides smoothly down lap on sit-up & shifts with breathing/tug)
  const chestLift = pose.blanketLift;
  const topRightY = 424 - chestLift * 0.55 + pose.blanketSlideDown;
  const midChestY = 434 - chestLift + pose.blanketSlideDown * 0.55;
  const kneeBump = 456 - chestLift * 0.35 + Math.sin(s.footFlex) * 4;

  ctx.save();
  const quiltGrad = ctx.createLinearGradient(440, 420, 440, 610);
  quiltGrad.addColorStop(0, '#44787d');
  quiltGrad.addColorStop(0.5, '#335d63');
  quiltGrad.addColorStop(1, '#244247');
  ctx.fillStyle = quiltGrad;
  ctx.strokeStyle = '#161b29';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(432, 540);
  ctx.quadraticCurveTo(462, 468, 560, kneeBump);
  ctx.quadraticCurveTo(705, midChestY, 825 - sitUp * 38, topRightY);
  ctx.quadraticCurveTo(862 - sitUp * 22, topRightY + 4, 868 - sitUp * 10, Math.min(542, topRightY + 52));
  ctx.lineTo(864, 578);
  ctx.quadraticCurveTo(640, 592, 432, 578);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Folded cream top sheet cuff following top blanket edge
  ctx.fillStyle = '#ece1cf';
  ctx.beginPath();
  ctx.moveTo(814 - sitUp * 38, topRightY);
  ctx.quadraticCurveTo(848 - sitUp * 25, topRightY, 862 - sitUp * 14, Math.min(538, topRightY + 34));
  ctx.lineTo(858 - sitUp * 12, Math.min(568, topRightY + 74));
  ctx.quadraticCurveTo(824 - sitUp * 32, Math.min(562, topRightY + 66), 804 - sitUp * 38, Math.min(542, topRightY + 42));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Diamond quilted stitching lines clipped inside blanket
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.6;
  for (let qx = 420; qx < 880; qx += 48) {
    ctx.beginPath();
    ctx.moveTo(qx, 420);
    ctx.lineTo(qx + 120, 600);
    ctx.moveTo(qx + 120, 420);
    ctx.lineTo(qx, 600);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawFoodSources(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const m = sim.mosquito;
  const activeFood = findNearestFoodSource(m.x, m.y, sim.foods);

  for (const food of sim.foods) {
    drawFoodProp(ctx, food, activeFood?.id === food.id && sim.phase === 'playing', timeSec, m.isDrinkingFood);
  }
}

function drawFoodProp(
  ctx: CanvasRenderingContext2D,
  food: FoodSource,
  isNear: boolean,
  timeSec: number,
  isDrinking: boolean
): void {
  const fillRatio = clamp(food.amount / 100, 0, 1);
  ctx.save();
  ctx.translate(food.x, food.y);

  if (fillRatio <= 0) {
    ctx.globalAlpha = 0.45;
  }

  if (food.kind === 'juice_glass') {
    // Forgotten Glass of Orange/Mango Juice with Straw
    ctx.fillStyle = 'rgba(200, 235, 255, 0.28)';
    ctx.strokeStyle = '#181424';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, -22);
    ctx.lineTo(11, -22);
    ctx.lineTo(9, 10);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (fillRatio > 0.05) {
      const topY = 8 - fillRatio * 22;
      ctx.fillStyle = '#ff9f38';
      ctx.beginPath();
      ctx.moveTo(-9.5, topY);
      ctx.lineTo(9.5, topY);
      ctx.lineTo(8, 8);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
    }

    // Striped straw
    ctx.strokeStyle = '#ff5a5f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, 4);
    ctx.lineTo(6, -28);
    ctx.lineTo(15, -31);
    ctx.stroke();
  } else if (food.kind === 'fruit_scrap') {
    // Sweet Apple / Berry Scrap
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d94848';
    ctx.strokeStyle = '#181424';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f5e2ba';
    ctx.beginPath();
    ctx.ellipse(0, 1, 8, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c8f52';
    ctx.beginPath();
    ctx.ellipse(6, -12, 5, 2.8, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Sticky Sweet Soda Spill on Floor/Rug
    const wobble = Math.sin(timeSec * 3) * 1.2;
    ctx.fillStyle = 'rgba(220, 95, 160, 0.72)';
    ctx.strokeStyle = 'rgba(255, 185, 225, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22 + wobble, 9, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(16, 6, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle snack interaction halo & prompt
  if (fillRatio > 0 && isNear && !isDrinking) {
    ctx.strokeStyle = 'rgba(255, 207, 92, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(20, 22, 38, 0.88)';
    roundRect(ctx, -40, -54, 80, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#a6e22e';
    ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD SNACK', 0, -43);
  }
  ctx.restore();
}

function drawSipTargets(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const m = sim.mosquito;
  const s = sim.sleeper;
  const activeTarget = findNearestSipTarget(m.x, m.y, sim.targets);

  for (const t of sim.targets) {
    const isNear = activeTarget?.id === t.id;
    const isScratchingSoon = s.scratchTargetId === t.id && s.scratchWindupTimer > 0;
    const isScratchingNow = s.scratchTargetId === t.id && s.scratchActiveTimer > 0;
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.5 + t.x * 0.02);

    ctx.save();
    ctx.translate(t.x, t.y);

    const ringRadius = isNear ? 28 + pulse * 4 : 18 + pulse * 4;
    ctx.strokeStyle = isScratchingSoon
      ? 'rgba(255, 190, 92, 0.95)'
      : isNear
        ? 'rgba(255, 112, 122, 0.85)'
        : 'rgba(255, 206, 138, 0.42)';
    ctx.lineWidth = isScratchingSoon || isNear ? 2.6 : 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (isScratchingNow) {
      ctx.strokeStyle = '#ffcf78';
      ctx.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-16 + i * 8, -14);
        ctx.lineTo(14 + i * 8, 14);
        ctx.stroke();
      }
    } else if (isScratchingSoon) {
      ctx.fillStyle = '#ffbe5c';
      ctx.font = '800 12px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ITCHY!', 0, -34);
    } else if (isNear && !m.isSipping) {
      ctx.fillStyle = 'rgba(20, 22, 38, 0.86)';
      roundRect(ctx, -34, -50, 68, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#ffdf9e';
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HOLD SIP', 0, -39);
    }
    ctx.restore();
  }
}

function drawSleeperArmAndSwat(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const s = sim.sleeper;
  const totalWindup = Math.max(0.05, s.swatDuration || (sim.subPhase === 'escape' ? HUNTER_WINDUP_DURATION : SWAT_WINDUP_DURATION));

  // 1. Swat windup target telegraph ring
  if (s.mood === 'windup') {
    const progress = 1 - clamp(s.swatTimer / totalWindup, 0, 1);
    const outerR = SWAT_HIT_RADIUS + (1 - progress) * 58;

    ctx.save();
    ctx.translate(s.swatX, s.swatY);

    ctx.fillStyle = `rgba(255, 82, 74, ${0.14 + progress * 0.2})`;
    ctx.beginPath();
    ctx.arc(0, 0, SWAT_HIT_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255, 110, 92, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, SWAT_HIT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ffcf5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffcf5c';
    ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -SWAT_HIT_RADIUS - 12);
    ctx.restore();
  }

  // 2. Curved motion swoosh trail during swat acceleration & impact
  if (s.mood === 'strike' && (s.swatStage === 'acceleration' || s.swatStage === 'impact')) {
    ctx.save();
    ctx.strokeStyle =
      s.swatVariation === 'sleepy_miss_swat'
        ? 'rgba(255, 240, 210, 0.28)'
        : 'rgba(255, 240, 210, 0.52)';
    ctx.lineWidth = s.swatStage === 'impact' ? 7 : 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.swatStartX, s.swatStartY);
    ctx.quadraticCurveTo(s.swatControlX, s.swatControlY, s.handX, s.handY);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Unified Articulated Arm (Shoulder -> Elbow -> Wrist -> Palm + 5 Shaped Fingers)
  const shoulderX = s.shoulderX;
  const shoulderY = s.shoulderY;
  const elbowX = s.elbowX;
  const elbowY = s.elbowY;
  const wristX = s.wristX;
  const wristY = s.wristY;

  const upperAng = Math.atan2(elbowY - shoulderY, elbowX - shoulderX);
  const sleeveEndX = shoulderX + Math.cos(upperAng) * 78;
  const sleeveEndY = shoulderY + Math.sin(upperAng) * 78;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Skin bite highlight on forearm if mosquito landed on forearm
  if (s.biteReactionTimer > 0 && s.biteReactionTargetId === 'forearm') {
    const glowAlpha = clamp(s.biteReactionTimer / 0.65, 0, 1) * 0.48;
    ctx.fillStyle = `rgba(255, 86, 98, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc((elbowX + wristX) * 0.5, (elbowY + wristY) * 0.5, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Exposed bare arm from shoulder -> elbow -> wrist (drawn smoothly as two connected bones)
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(wristX, wristY);
  ctx.stroke();

  ctx.strokeStyle = '#f2b59a';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(wristX, wristY);
  ctx.stroke();

  // Pajama sleeve covering upper arm down toward elbow
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 31;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(sleeveEndX, sleeveEndY);
  ctx.stroke();

  ctx.strokeStyle = '#53678f';
  ctx.lineWidth = 25;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(sleeveEndX, sleeveEndY);
  ctx.stroke();

  // Crisp pajama sleeve cuff band
  ctx.save();
  ctx.translate(sleeveEndX, sleeveEndY);
  ctx.rotate(upperAng);
  ctx.fillStyle = '#d7deed';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2;
  roundRect(ctx, -4, -13, 8, 26, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Shaped Palm & 5 Articulated Fingers (continuous scale + impact splay/squash, zero pop!)
  const impactSquash = clamp(s.swatImpactSquash, 0, 1);
  const handScaleX = 0.98 * (1 + impactSquash * 0.16);
  const handScaleY = 0.98 * (1 - impactSquash * 0.08);
  const curl = clamp(s.fingerCurl, 0, 1);
  const scratchFlutter =
    s.scratchActiveTimer > 0 || s.sleepBehavior === 'nose_scratch'
      ? Math.sin(timeSec * 28) * 0.18
      : 0;

  ctx.translate(s.handX, s.handY);
  ctx.rotate(s.handRotation);
  ctx.scale(handScaleX, handScaleY);

  // Palm
  ctx.fillStyle = '#f4b99f';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-13, 14);
  ctx.quadraticCurveTo(-18, -2, -14, -14);
  ctx.quadraticCurveTo(0, -18, 15, -13);
  ctx.quadraticCurveTo(18, 2, 12, 14);
  ctx.quadraticCurveTo(0, 18, -13, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 4 main fingers (index, middle, ring, pinky) + thumb, curling organically with `curl`!
  const fingers: Array<{ x: number; y: number; len: number; w: number; spread: number; idx: number }> = [
    { x: -11, y: -12, len: 18, w: 4.5, spread: -0.26, idx: 0 },
    { x: -3.5, y: -14, len: 21, w: 4.7, spread: -0.07, idx: 1 },
    { x: 4.5, y: -14, len: 20, w: 4.5, spread: 0.09, idx: 2 },
    { x: 11.5, y: -11, len: 16, w: 4.0, spread: 0.28, idx: 3 },
  ];

  for (const f of fingers) {
    const fLen = f.len * (1 - curl * 0.42);
    const rot = f.spread * (1 - curl * 0.55) + scratchFlutter * (f.idx % 2 === 0 ? 1 : -1);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(rot);
    ctx.fillStyle = '#f4b99f';
    ctx.strokeStyle = '#1b1626';
    ctx.lineWidth = 2.1;
    roundRect(ctx, -f.w, -fLen, f.w * 2, fLen + 3, f.w);
    ctx.fill();
    ctx.stroke();

    // Knuckle crease
    ctx.strokeStyle = 'rgba(130, 72, 60, 0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-f.w * 0.5, -fLen * 0.48);
    ctx.lineTo(f.w * 0.5, -fLen * 0.48);
    ctx.stroke();
    ctx.restore();
  }

  // Thumb
  ctx.save();
  ctx.translate(-14, 3);
  ctx.rotate(-0.85 + curl * 0.42);
  ctx.fillStyle = '#f0b196';
  ctx.strokeStyle = '#1b1626';
  ctx.lineWidth = 2.1;
  roundRect(ctx, -4.2, -14, 8.4, 17, 4.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawMosquitoShadow(ctx: CanvasRenderingContext2D, sim: GameSimulation): void {
  const m = sim.mosquito;
  const shadowY = Math.min(698, m.y + 85);
  const heightRatio = clamp(1 - (shadowY - m.y) / 260, 0.25, 1);
  ctx.save();
  ctx.fillStyle = `rgba(8, 10, 20, ${0.28 * heightRatio})`;
  ctx.beginPath();
  ctx.ellipse(
    m.x + 12,
    shadowY,
    (16 + m.bloatLevel * 6) * heightRatio,
    6 * heightRatio,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

function drawMosquito(
  ctx: CanvasRenderingContext2D,
  sim: GameSimulation,
  timeSec: number
): void {
  const m = sim.mosquito;
  const hoverBob =
    m.mood === 'hover' || m.mood === 'bloated'
      ? Math.sin(timeSec * 5.2) * (3.5 + m.bloatLevel * 2.5)
      : 0;

  const hasTurboWings = hasUpgrade(sim, 'turbo_wings');
  const hasMegaProboscis = hasUpgrade(sim, 'mega_proboscis');
  const hasNinja = hasUpgrade(sim, 'ninja_mosquito');
  const hasBloodTank = hasUpgrade(sim, 'blood_tank');
  const hasEmergencyDash = hasUpgrade(sim, 'emergency_dash');

  ctx.save();
  ctx.translate(m.x, m.y + hoverBob);
  ctx.rotate(m.tilt + (m.sneezeLaunchTimer > 0 ? timeSec * 16 : 0));
  ctx.scale(m.facing * m.squashX, m.squashY);

  const wingFlap = Math.sin(m.wingPhase);
  const wingFlapAlt = Math.cos(m.wingPhase * 1.07);
  const isFast = m.mood === 'fast' || m.mood === 'dash' || m.mood === 'panicked';

  if (isFast) {
    ctx.fillStyle = hasTurboWings
      ? 'rgba(120, 235, 255, 0.34)'
      : 'rgba(214, 240, 255, 0.24)';
    ctx.beginPath();
    ctx.ellipse(-4, -14, hasTurboWings ? 24 : 20, 14, -0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Back wing (tinted sleek cyan with Turbo Wings!)
  ctx.save();
  ctx.translate(-3, -6);
  ctx.rotate(-0.55 + wingFlapAlt * 0.42);
  ctx.fillStyle = hasTurboWings ? 'rgba(130, 235, 255, 0.65)' : 'rgba(218, 242, 255, 0.56)';
  ctx.strokeStyle = hasTurboWings ? 'rgba(85, 195, 235, 0.85)' : 'rgba(130, 175, 210, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(-8, -10, hasTurboWings ? 17 : 14, 5.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 6 Springy Legs
  ctx.strokeStyle = '#1b1728';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const legSpread = m.isSipping || m.isDrinkingFood ? i * 7 : isFast ? -6 + i * 3 : i * 5.5;
    const kneeY = m.isSipping || m.isDrinkingFood ? 9 : isFast ? 5 : 10 + Math.sin(timeSec * 8 + i) * 1.5;
    const footY = m.isSipping || m.isDrinkingFood ? 15 : isFast ? 7 : 17;
    const footX = m.isSipping || m.isDrinkingFood ? i * 10 : isFast ? -16 + i * 4 : i * 8 - 3;
    ctx.beginPath();
    ctx.moveTo(i * 3, 4);
    ctx.lineTo(legSpread, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
  }

  // Striped Abdomen (visibly swells from bellyFill AND comical greedy bloat!)
  const fillRatio = clamp(m.bellyFill / 100, 0, 1);
  const bloatWobble = m.bloatLevel > 0.35 ? Math.sin(timeSec * 14) * 1.2 * m.bloatLevel : 0;
  const abRx = 11 + fillRatio * 5.5 + m.bloatLevel * 8 + bloatWobble;
  const abRy = 6 + fillRatio * 4.5 + m.bloatLevel * 7 - bloatWobble * 0.5;

  ctx.save();
  ctx.translate(-12 - m.bloatLevel * 3, 2);
  ctx.rotate(m.isSipping ? 0.25 : -0.18);
  ctx.fillStyle = fillRatio > 0.08 ? '#c93448' : '#535870';
  ctx.strokeStyle = '#181424';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, abRx, abRy, 0, 0, Math.PI * 2);
  ctx.fill();

  if (fillRatio > 0.05) {
    const bellyGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, abRx);
    bellyGlow.addColorStop(0, `rgba(255, 110, 128, ${0.4 + fillRatio * 0.5})`);
    bellyGlow.addColorStop(1, 'rgba(180, 28, 48, 0)');
    ctx.fillStyle = bellyGlow;
    ctx.fill();
  }

  // Abdomen stripes
  ctx.strokeStyle = 'rgba(22, 18, 34, 0.72)';
  ctx.lineWidth = 2;
  for (let s = -1; s <= 1; s++) {
    ctx.beginPath();
    ctx.moveTo(s * 4.5, -abRy + 1.5);
    ctx.lineTo(s * 4.5, abRy - 1.5);
    ctx.stroke();
  }

  // Blood Tank brass harness visual upgrade!
  if (hasBloodTank) {
    ctx.strokeStyle = '#ffbe5c';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -abRy);
    ctx.lineTo(0, abRy);
    ctx.stroke();
  }

  // Emergency Dash electric tail thrusters visual upgrade!
  if (hasEmergencyDash) {
    ctx.fillStyle = '#a6e22e';
    ctx.beginPath();
    ctx.arc(-abRx - 1, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#181424';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, abRx, abRy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Thorax
  ctx.fillStyle = '#3c4054';
  ctx.strokeStyle = '#181424';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = '#4a4f66';
  ctx.beginPath();
  ctx.arc(9, -2, 6.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ninja Mosquito headband visual upgrade!
  if (hasNinja) {
    ctx.fillStyle = '#e63946';
    ctx.fillRect(3, -8.5, 11.5, 3.2);
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 2.2;
    const ribbonWave = Math.sin(timeSec * 12) * 3;
    ctx.beginPath();
    ctx.moveTo(3, -7);
    ctx.quadraticCurveTo(-5, -10 + ribbonWave, -11, -6 + ribbonWave);
    ctx.stroke();
  }

  // Proboscis (gleaming brass needle if Mega Proboscis unlocked!)
  ctx.strokeStyle = hasMegaProboscis ? '#ffbe5c' : '#181424';
  ctx.lineWidth = hasMegaProboscis ? 3 : 2.1;
  ctx.beginPath();
  const probLen = hasMegaProboscis ? 33 : 27;
  if (m.mood === 'swatted') {
    ctx.moveTo(15, -1);
    ctx.quadraticCurveTo(21, -7, 25, 2);
  } else if (m.isSipping || m.isDrinkingFood) {
    ctx.moveTo(14, 1);
    ctx.lineTo(18, hasMegaProboscis ? 17 : 14);
  } else {
    ctx.moveTo(15, -1);
    ctx.lineTo(probLen, 2);
  }
  ctx.stroke();

  // Antennae
  ctx.strokeStyle = '#181424';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(11, -8);
  ctx.quadraticCurveTo(15, -15, 20, -14);
  ctx.moveTo(9, -8);
  ctx.quadraticCurveTo(11, -15, 14, -16);
  ctx.stroke();

  // Big Expressive Eyes
  const eyeX = 11;
  const eyeY = -4;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#181424';
  ctx.lineWidth = 1.8;

  if (m.mood === 'swatted') {
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeX - 2.5, eyeY - 2.5);
    ctx.lineTo(eyeX + 2.5, eyeY + 2.5);
    ctx.moveTo(eyeX + 2.5, eyeY - 2.5);
    ctx.lineTo(eyeX - 2.5, eyeY + 2.5);
    ctx.stroke();
  } else if (m.mood === 'panicked') {
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#181424';
    ctx.beginPath();
    ctx.arc(eyeX + 1.2, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.isSipping || m.isDrinkingFood) {
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3c4054';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4.6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#181424';
    ctx.beginPath();
    ctx.arc(eyeX + 1, eyeY + 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const lookX = clamp(m.vx * 0.008, -1.2, 1.8);
    const lookY = clamp(m.vy * 0.008, -1.5, 1.5);
    ctx.fillStyle = '#181424';
    ctx.beginPath();
    ctx.arc(eyeX + 0.8 + lookX * m.facing, eyeY + lookY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Front translucent wing
  ctx.save();
  ctx.translate(-1, -4);
  ctx.rotate(-0.2 + wingFlap * 0.52);
  ctx.fillStyle = hasTurboWings ? 'rgba(158, 245, 255, 0.78)' : 'rgba(232, 248, 255, 0.72)';
  ctx.strokeStyle = hasTurboWings ? 'rgba(85, 200, 235, 0.9)' : 'rgba(130, 175, 210, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-9, -8, hasTurboWings ? 19 : 16, 6.2, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160, 205, 235, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(-18, -10);
  ctx.stroke();
  ctx.restore();

  if (m.mood === 'panicked' || m.bloatLevel >= 0.6) {
    ctx.fillStyle = '#92e2ff';
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.quadraticCurveTo(8, -11, 4, -9);
    ctx.quadraticCurveTo(0, -11, 4, -18);
    ctx.fill();
  }

  ctx.restore();
}

function drawParticlesAndTexts(ctx: CanvasRenderingContext2D, effects: EffectsPool): void {
  for (const p of effects.particles) {
    if (!p.active) continue;
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.kind === 'zzz') {
      ctx.fillStyle = p.color;
      ctx.font = `700 ${Math.round(p.size)}px "Bricolage Grotesque", sans-serif`;
      ctx.fillText('z', p.x, p.y);
    } else if (p.kind === 'note') {
      ctx.fillStyle = p.color;
      ctx.font = `700 ${Math.round(p.size)}px "Bricolage Grotesque", sans-serif`;
      ctx.fillText('♪', p.x, p.y);
    } else if (p.kind === 'wind') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08);
      ctx.stroke();
    } else if (p.kind === 'feather') {
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.life * 6) * 0.7);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'dust' ? 1 : alpha * 0.6 + 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const ft of effects.texts) {
    if (!ft.active) continue;
    const alpha = clamp((ft.life / ft.maxLife) * 1.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${Math.round(18 * ft.scale)}px "Bricolage Grotesque", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#121424';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

function drawForegroundSilhouettes(ctx: CanvasRenderingContext2D, timeSec: number): void {
  const sway = Math.sin(timeSec * 0.9) * 0.04;

  ctx.save();
  ctx.translate(22, 810);
  ctx.fillStyle = '#090c18';
  const leaves = [
    [-0.85, 165, 28],
    [-0.45, 205, 32],
    [-0.1, 180, 26],
    [0.32, 145, 24],
  ];
  for (const [angle, len, width] of leaves) {
    ctx.save();
    ctx.rotate(angle + sway);
    ctx.beginPath();
    ctx.ellipse(0, -len * 0.5, width, len * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#090b16';
  ctx.beginPath();
  ctx.moveTo(1185, 800);
  ctx.quadraticCurveTo(1235, 710, 1295, 675);
  ctx.lineTo(1295, 800);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAtmosphericVignette(ctx: CanvasRenderingContext2D, sim: GameSimulation): void {
  if (!sim.lightsOn) {
    const vigLayer = getVignetteLayer();
    if (vigLayer) {
      ctx.drawImage(vigLayer, 0, 0);
    }
  }

  if (sim.sleeper.mood === 'windup' || sim.sleeper.mood === 'strike') {
    ctx.fillStyle = 'rgba(255, 72, 68, 0.14)';
    ctx.fillRect(0, 0, WORLD_WIDTH, 22);
    ctx.fillRect(0, WORLD_HEIGHT - 22, WORLD_WIDTH, 22);
    ctx.fillRect(0, 22, 22, WORLD_HEIGHT - 44);
    ctx.fillRect(WORLD_WIDTH - 22, 22, 22, WORLD_HEIGHT - 44);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
