import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DoCheck, ElementRef, EventEmitter, HostListener, OnDestroy, Output, ViewChild } from '@angular/core';
import { ActiveElement, Chart, ChartEvent } from 'chart.js/auto';
import { CHART_COLORS } from '../chart-colors';
import { TrackerStoreService } from '../state/tracker-store.service';

type DashboardChartKey = 'spendTrend' | 'attendance' | 'attendanceRate' | 'payOwe' | 'balance';

export interface DashboardDrilldown {
  tab: string;
  memberId?: number;
}

@Component({
  selector: 'app-dashboard-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-tab.component.html',
  styleUrls: ['./dashboard-tab.component.less']
})
export class DashboardTabComponent implements AfterViewInit, DoCheck, OnDestroy {
  @ViewChild('spendTrendCanvas') spendTrendCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('attendanceCanvas') attendanceCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('attendanceRateCanvas') attendanceRateCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('payOweCanvas') payOweCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('balanceCanvas') balanceCanvas?: ElementRef<HTMLCanvasElement>;

  @Output() drilldown = new EventEmitter<DashboardDrilldown>();

  private spendChart?: Chart;
  private attendanceChart?: Chart;
  private attendanceRateChart?: Chart;
  private payOweChart?: Chart;
  private balanceChart?: Chart;
  private viewReady = false;
  private lastSignature = '';

  // id arrays stored at render time so click handlers can resolve members by index
  private attendanceRateMemberOrder: number[] = [];
  private balanceMemberOrder: number[] = [];
  private payOweMemberOrder: number[] = [];

  expandedCard: DashboardChartKey | null = null;

  constructor(public readonly store: TrackerStoreService) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngDoCheck(): void {
    if (!this.viewReady) return;

    const signature = this.getSignature();
    if (signature !== this.lastSignature) {
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.expandedCard) this.collapseCard();
  }

  expandCard(key: DashboardChartKey): void {
    this.expandedCard = key;
    setTimeout(() => this.resizeAllCharts(), 50);
  }

  collapseCard(): void {
    this.expandedCard = null;
    setTimeout(() => this.resizeAllCharts(), 50);
  }

  exportChart(key: DashboardChartKey): void {
    const canvas = this.getCanvasByKey(key);
    if (!canvas) return;

    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const ctx = tmp.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = CHART_COLORS.bgCard;
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);

    const titles: Record<DashboardChartKey, string> = {
      spendTrend: 'spend-trend',
      attendance: 'attendance-by-session',
      attendanceRate: 'member-attendance-rate',
      payOwe: 'pay-vs-owe',
      balance: 'net-balance'
    };

    const link = document.createElement('a');
    link.download = `${titles[key]}.png`;
    link.href = tmp.toDataURL('image/png');
    link.click();
  }

  private getCanvasByKey(key: DashboardChartKey): HTMLCanvasElement | undefined {
    switch (key) {
      case 'spendTrend':     return this.spendTrendCanvas?.nativeElement;
      case 'attendance':     return this.attendanceCanvas?.nativeElement;
      case 'attendanceRate': return this.attendanceRateCanvas?.nativeElement;
      case 'payOwe':         return this.payOweCanvas?.nativeElement;
      case 'balance':        return this.balanceCanvas?.nativeElement;
    }
  }

  private resizeAllCharts(): void {
    this.spendChart?.resize();
    this.attendanceChart?.resize();
    this.attendanceRateChart?.resize();
    this.payOweChart?.resize();
    this.balanceChart?.resize();
  }

  private renderCharts(): void {
    if (
      !this.store.data ||
      !this.spendTrendCanvas ||
      !this.attendanceCanvas ||
      !this.attendanceRateCanvas ||
      !this.payOweCanvas ||
      !this.balanceCanvas
    ) {
      return;
    }

    this.destroyCharts();

    const sessions = this.store.data.sessions;
    const summary = this.store.summary;

    const sessionLabels = sessions.map(session => session.date || 'Session ' + session.id);
    const sessionCosts = sessions.map(session => session.cost || 0);
    const attendanceCounts = sessions.map(session => (this.store.data?.attendance[String(session.id)] || []).length);
    const totalSessions = sessions.length;

    const sortedByBalance = [...summary].sort((a, b) => b.balance - a.balance);
    const memberLabels = sortedByBalance.map(item => item.name);
    const memberBalances = sortedByBalance.map(item => Number(item.balance.toFixed(2)));
    const memberPaid = sortedByBalance.map(item => Number(item.paid.toFixed(2)));
    const memberOwed = sortedByBalance.map(item => Number(item.owed.toFixed(2)));
    const attendanceRateRows = sortedByBalance.map(item => {
      if (totalSessions === 0) {
        return { id: item.id, name: item.name, rate: 0 };
      }

      const attended = sessions.filter(session => (this.store.data?.attendance[String(session.id)] || []).includes(item.id)).length;
      return {
        id: item.id,
        name: item.name,
        rate: Number(((attended / totalSessions) * 100).toFixed(1))
      };
    });
    const sortedAttendanceRateRows = attendanceRateRows
      .slice()
      .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
    const attendanceRateLabels = sortedAttendanceRateRows.map(item => item.name);
    const attendanceRate = sortedAttendanceRateRows.map(item => item.rate);

    // Store id order for click handler resolution
    this.attendanceRateMemberOrder = sortedAttendanceRateRows.map(row => row.id);
    this.balanceMemberOrder = sortedByBalance.map(item => item.id);
    this.payOweMemberOrder = sortedByBalance.map(item => item.id);

    const baseScales = {
      x: { ticks: { color: CHART_COLORS.textNeutral }, grid: { color: CHART_COLORS.border } },
      y: { ticks: { color: CHART_COLORS.textNeutral }, grid: { color: CHART_COLORS.border } }
    };

    this.spendChart = new Chart(this.spendTrendCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: sessionLabels,
        datasets: [
          {
            label: 'Session Cost (Rs)',
            data: sessionCosts,
            borderColor: CHART_COLORS.accent,
            backgroundColor: CHART_COLORS.accentFill,
            fill: true,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          this.drilldown.emit({ tab: 'sessions' });
        },
        plugins: { legend: { labels: { color: CHART_COLORS.legendText } } },
        scales: baseScales
      }
    });

    this.attendanceChart = new Chart(this.attendanceCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: sessionLabels,
        datasets: [
          {
            label: 'Attendees',
            data: attendanceCounts,
            backgroundColor: CHART_COLORS.accent,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          this.drilldown.emit({ tab: 'attendance' });
        },
        plugins: { legend: { labels: { color: CHART_COLORS.legendText } } },
        scales: baseScales
      }
    });

    this.balanceChart = new Chart(this.balanceCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: memberLabels,
        datasets: [
          {
            label: 'Net Balance (Rs)',
            data: memberBalances,
            backgroundColor: memberBalances.map(value => (value >= 0 ? CHART_COLORS.accent : CHART_COLORS.danger))
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          const memberId = this.balanceMemberOrder[elements[0].index];
          if (memberId) this.drilldown.emit({ tab: 'members', memberId });
        },
        plugins: { legend: { labels: { color: CHART_COLORS.legendText } } },
        scales: baseScales
      }
    });

    this.attendanceRateChart = new Chart(this.attendanceRateCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: attendanceRateLabels,
        datasets: [
          {
            label: 'Attendance Rate (%)',
            data: attendanceRate,
            backgroundColor: CHART_COLORS.info,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          const memberId = this.attendanceRateMemberOrder[elements[0].index];
          if (memberId) this.drilldown.emit({ tab: 'members', memberId });
        },
        plugins: { legend: { labels: { color: CHART_COLORS.legendText } } },
        scales: {
          x: { ticks: { color: CHART_COLORS.textNeutral }, grid: { color: CHART_COLORS.border }, min: 0, max: 100 },
          y: { ticks: { color: CHART_COLORS.textNeutral }, grid: { color: CHART_COLORS.border } }
        }
      }
    });

    this.payOweChart = new Chart(this.payOweCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: memberLabels,
        datasets: [
          {
            label: 'Paid (Rs)',
            data: memberPaid,
            backgroundColor: CHART_COLORS.accent
          },
          {
            label: 'Owed (Rs)',
            data: memberOwed,
            backgroundColor: CHART_COLORS.warning
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          const memberId = this.payOweMemberOrder[elements[0].index];
          if (memberId) this.drilldown.emit({ tab: 'members', memberId });
        },
        plugins: { legend: { labels: { color: CHART_COLORS.legendText } } },
        scales: baseScales
      }
    });

    this.lastSignature = this.getSignature();
  }

  private destroyCharts(): void {
    this.spendChart?.destroy();
    this.attendanceChart?.destroy();
    this.attendanceRateChart?.destroy();
    this.payOweChart?.destroy();
    this.balanceChart?.destroy();
  }

  private getSignature(): string {
    const data = this.store.data;
    if (!data) return 'no-data';

    const sessionsSig = data.sessions.map(session => session.id + ':' + session.cost + ':' + session.date).join('|');
    const attendanceSig = data.sessions
      .map(session => session.id + ':' + (data.attendance[String(session.id)] || []).length)
      .join('|');
    const balanceSig = this.store.summary.map(item => item.name + ':' + item.balance.toFixed(2)).join('|');

    return sessionsSig + '::' + attendanceSig + '::' + balanceSig;
  }
}
