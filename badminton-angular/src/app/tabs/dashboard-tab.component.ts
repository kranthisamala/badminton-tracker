import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DoCheck, ElementRef, EventEmitter, HostListener, OnDestroy, Output, ViewChild } from '@angular/core';
import { ActiveElement, Chart, ChartEvent } from 'chart.js/auto';
import { TrackerStoreService } from '../state/tracker-store.service';

type DashboardChartKey = 'spendTrend' | 'attendance' | 'attendanceRate' | 'payOwe' | 'balance';

export interface DashboardDrilldown {
  tab: string;
  member?: string;
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

  // label arrays stored at render time so click handlers can resolve names by index
  private attendanceRateMemberOrder: string[] = [];
  private balanceMemberOrder: string[] = [];
  private payOweMemberOrder: string[] = [];

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
    const attendanceRateRows = memberLabels.map(member => {
      if (totalSessions === 0) {
        return { member, rate: 0 };
      }

      const attended = sessions.filter(session => (this.store.data?.attendance[String(session.id)] || []).includes(member)).length;
      return {
        member,
        rate: Number(((attended / totalSessions) * 100).toFixed(1))
      };
    });
    const sortedAttendanceRateRows = attendanceRateRows
      .slice()
      .sort((a, b) => b.rate - a.rate || a.member.localeCompare(b.member));
    const attendanceRateLabels = sortedAttendanceRateRows.map(item => item.member);
    const attendanceRate = sortedAttendanceRateRows.map(item => item.rate);

    // Store label order for click handler resolution
    this.attendanceRateMemberOrder = sortedAttendanceRateRows.map(row => row.member);
    this.balanceMemberOrder = sortedByBalance.map(item => item.name);
    this.payOweMemberOrder = sortedByBalance.map(item => item.name);

    const baseScales = {
      x: { ticks: { color: '#9bb0a2' }, grid: { color: '#2a332e' } },
      y: { ticks: { color: '#9bb0a2' }, grid: { color: '#2a332e' } }
    };

    this.spendChart = new Chart(this.spendTrendCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: sessionLabels,
        datasets: [
          {
            label: 'Session Cost (Rs)',
            data: sessionCosts,
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.2)',
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
        plugins: { legend: { labels: { color: '#c8d8ce' } } },
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
            backgroundColor: '#22c55e',
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
        plugins: { legend: { labels: { color: '#c8d8ce' } } },
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
            backgroundColor: memberBalances.map(value => (value >= 0 ? '#4ade80' : '#f87171'))
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          const member = this.balanceMemberOrder[elements[0].index];
          if (member) this.drilldown.emit({ tab: 'members', member });
        },
        plugins: { legend: { labels: { color: '#c8d8ce' } } },
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
            backgroundColor: '#60a5fa',
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
          const member = this.attendanceRateMemberOrder[elements[0].index];
          if (member) this.drilldown.emit({ tab: 'members', member });
        },
        plugins: { legend: { labels: { color: '#c8d8ce' } } },
        scales: {
          x: { ticks: { color: '#9bb0a2' }, grid: { color: '#2a332e' }, min: 0, max: 100 },
          y: { ticks: { color: '#9bb0a2' }, grid: { color: '#2a332e' } }
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
            backgroundColor: '#4ade80'
          },
          {
            label: 'Owed (Rs)',
            data: memberOwed,
            backgroundColor: '#f59e0b'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
          if (!elements.length) return;
          const member = this.payOweMemberOrder[elements[0].index];
          if (member) this.drilldown.emit({ tab: 'members', member });
        },
        plugins: { legend: { labels: { color: '#c8d8ce' } } },
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
