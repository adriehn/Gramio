import {
  Component,
  inject,
  AfterViewInit,
  DestroyRef,
  ElementRef,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// DATOS ILUSTRATIVOS DEL GRÁFICO PRINCIPAL
// ==========================================
const DAYS = 56;
const WINDOW = 28;
const KCAL_PER_KG = 7700;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtInt = (n: number) => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtDec = (n: number, d = 1) => Math.abs(n).toFixed(d).replace('.', ',');
const fmtSigned = (n: number, d = 1) => {
  if (Math.round(Math.abs(n) * 10 ** d) === 0) return fmtDec(0, d);
  return (n < 0 ? '−' : '+') + fmtDec(n, d);
};

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DayPoint {
  date: string;
  weight: number;
  trend: number;
  intake: number;
  weightLabel: string;
  trendLabel: string;
  intakeLabel: string;
}

function buildDemo() {
  const rand = mulberry32(20261101);
  const triangular = () => rand() + rand() - 1;
  const points: DayPoint[] = [];
  let trend = 0;

  for (let i = 0; i < DAYS; i++) {
    const weekday = i % 7;
    const base = 87.4 - 3.0 * (i / (DAYS - 1)) + Math.sin(i / 4.5) * 0.12;
    const waterSpike = i === 22 ? 0.9 : i === 38 ? 1.5 : 0;
    const weight = Math.round((base + triangular() * 0.55 + waterSpike) * 10) / 10;
    const intake = Math.round(2100 + triangular() * 260 + (weekday === 0 || weekday === 6 ? 280 : 0));

    trend = i === 0 ? weight : trend + 0.18 * (weight - trend);
    const d = new Date(2026, 8, 6 + i);
    
    points.push({
      date: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      weight,
      trend,
      intake,
      weightLabel: fmtDec(weight, 1),
      trendLabel: fmtDec(trend, 1),
      intakeLabel: fmtInt(intake)
    });
  }

  const lo = Math.floor(Math.min(...points.map(p => p.weight)));
  const hi = Math.ceil(Math.max(...points.map(p => p.weight)));
  const pctX = (i: number) => (i / (DAYS - 1)) * 100;
  const pctY = (v: number) => ((hi - v) / (hi - lo)) * 100;

const dotsPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(pctX(i) * 10).toFixed(1)} ${(pctY(p.weight) * 4).toFixed(1)}`).join('');
  const trendPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(pctX(i) * 10).toFixed(1)} ${(pctY(p.trend) * 4).toFixed(1)}`).join('');
  const barsPath = points.map((p, i) => {
    const h = Math.max(4, Math.min(80, ((p.intake - 1500) / (2800 - 1500)) * 80));
    return `M${(pctX(i) * 10).toFixed(1)} 80V${(80 - h).toFixed(1)}`;
  }).join('');

  const yTicks = Array.from({ length: hi - lo + 1 }, (_, k) => ({ label: `${lo + k} kg`, top: pctY(lo + k) }));
  const xTicks = [0, 14, 28, 42, 55].map((i, k, arr) => ({
    label: points[i].date,
    left: pctX(i),
    shift: k === 0 ? '0%' : k === arr.length - 1 ? '-100%' : '-50%'
  }));

  const last = DAYS - 1;
  const delta = points[last].trend - points[last - WINDOW].trend;
  const avgIntake = points.slice(-WINDOW).reduce((s, p) => s + p.intake, 0) / WINDOW;
  const fromBody = (-delta * KCAL_PER_KG) / WINDOW;
  const tdee = avgIntake + fromBody;
  const estimated = Math.round((tdee * 1.07) / 10) * 10;
  const period = points[last].trend - points[0].trend;
  const weeklySlope = delta / (WINDOW / 7);

  let spike = 8, spikeDev = 0;
  for (let i = 8; i < DAYS - 8; i++) {
    const dev = points[i].weight - points[i].trend;
    if (dev > spikeDev) { spikeDev = dev; spike = i; }
  }

  const weeklyRaw = Array.from({ length: 8 }, (_, w) => points[7 * w + 6].trend - (w === 0 ? points[0].trend : points[7 * w - 1].trend));
  const maxWeekly = Math.max(...weeklyRaw.map(Math.abs));
  const weeks = weeklyRaw.map((v, w) => ({
    name: `S${w + 1}`,
    label: fmtSigned(v, 1),
    height: Math.max(0.2, (Math.abs(v) / maxWeekly) * 6),
    up: v > 0
  }));

  return {
    days: points, dotsPath, trendPath, barsPath, yTicks, xTicks,
    px: points.map((_, i) => pctX(i)),
    weightTop: points.map(p => pctY(p.weight)),
    trendTop: points.map(p => pctY(p.trend)),
    end: { left: 100, top: pctY(points[last].trend) },
    note: { left: pctX(spike), top: pctY(points[spike].weight), flip: pctX(spike) > 60, text: `${fmtSigned(spikeDev, 1)} kg en un día: agua, no grasa` },
    weeks,
    ariaLabel: `Gráfico ilustrativo de ${DAYS} días. Los pesajes diarios fluctúan, pero la tendencia baja ${fmtDec(period, 1)} kg.`,
    stats: {
      tdee: fmtInt(tdee), estimated: fmtInt(estimated), diff: fmtSigned(tdee - estimated, 0),
      avgIntake: fmtInt(avgIntake), delta: fmtSigned(delta, 2), fromBody: fmtSigned(fromBody, 0),
      weekly: fmtSigned(weeklySlope, 2), period: fmtSigned(period, 1),
      estWidth: (estimated / 3200) * 100, obsWidth: (tdee / 3200) * 100
    }
  };
}

// ==========================================
// COMPONENTE
// ==========================================

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements AfterViewInit {
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('pageRoot', { static: true }) pageRoot!: ElementRef<HTMLElement>;

  readonly demo = buildDemo();
  readonly hover = signal<number | null>(null);

  readonly hoverInfo = computed(() => {
    const i = this.hover();
    if (i === null) return null;
    return {
      day: this.demo.days[i],
      left: this.demo.px[i],
      weightTop: this.demo.weightTop[i],
      trendTop: this.demo.trendTop[i],
      flip: i > DAYS * 0.62
    };
  });

  private readonly prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    if (this.prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      this.animateHero();
      this.animateStory();
    }, this.pageRoot.nativeElement);

    // Limpieza reactiva de GSAP atada al ciclo de vida del componente
    this.destroyRef.onDestroy(() => ctx.revert());
  }

  onChartPointer(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.hover.set(Math.round(ratio * (DAYS - 1)));
  }

  onChartLeave(): void {
    this.hover.set(null);
  }

  onChartKey(event: KeyboardEvent): void {
    const current = this.hover() ?? DAYS - 1;
    if (event.key === 'ArrowLeft') this.hover.set(Math.max(0, current - 1));
    else if (event.key === 'ArrowRight') this.hover.set(Math.min(DAYS - 1, current + 1));
    else if (event.key === 'Escape') this.hover.set(null);
    else return;
    event.preventDefault();
  }

  private animateHero(): void {
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero-title .line-in', { yPercent: 108, duration: 1, stagger: 0.11 })
      .from('.hero-foot > *', { opacity: 0, y: 16, duration: 0.7, stagger: 0.1 }, '-=0.55')
      .from('.chart-box', { opacity: 0, y: 28, duration: 0.8 }, '-=0.5')
      .fromTo('.chart-reveal', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.9, ease: 'power2.inOut', clearProps: 'clipPath' }, '-=0.3')
      .from('.end-marker, .chart-note', { opacity: 0, duration: 0.5, stagger: 0.15 }, '-=0.2');
  }

  private animateStory(): void {
    const root = this.pageRoot.nativeElement;
    const section = root.querySelector<HTMLElement>('.story');
    const steps = gsap.utils.toArray<HTMLElement>('.story-step', root);
    const labels = gsap.utils.toArray<HTMLElement>('.story-progress li', root);
    const bar = root.querySelector<HTMLElement>('.progress-bar');

    if (!section || !bar || steps.length < 2) return;

    ScrollTrigger.matchMedia({
      '(min-width: 901px) and (min-height: 780px)': () => {
        section.classList.add('is-pinned');
        const setActive = (active: number) => labels.forEach((label, i) => label.classList.toggle('is-active', i === active));
        
        setActive(0);
        gsap.set(steps.slice(1), { autoAlpha: 0 });
        let marks: number[] = [];

        const timeline = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          scrollTrigger: {
            trigger: section, pin: true, start: 'top top',
            end: `+=${steps.length * 100}%`, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true
          },
          onUpdate: () => {
            const time = timeline.time();
            let active = 0;
            marks.forEach((mark, i) => { if (time >= mark) active = i + 1; });
            setActive(active);
          }
        });

        steps.forEach((step, i) => {
          if (i > 0) {
            const label = `step${i}`;
            timeline.addLabel(label)
              .to(steps[i - 1], { autoAlpha: 0, y: -36, duration: 0.5 }, label)
              .fromTo(step, { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, `${label}+=0.25`);
          }
          timeline.to({}, { duration: 1 });
        });

        marks = steps.slice(1).map((_, i) => (timeline.labels[`step${i + 1}`] as number) + 0.3);
        timeline.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: timeline.duration(), ease: 'none' }, 0);

        return () => {
          section.classList.remove('is-pinned');
          labels.forEach(label => label.classList.remove('is-active'));
        };
      }
    });
  }
}