import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DoCheck, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { MemberReport } from '../models';
import { TrackerStoreService } from '../state/tracker-store.service';

@Component({
  selector: 'app-member-report-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-report-modal.component.html'
})
export class MemberReportModalComponent implements AfterViewInit, DoCheck, OnDestroy {
  @Input({ required: true }) report!: MemberReport;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('attendanceMixCanvas') attendanceMixCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('paymentsCanvas') paymentsCanvas?: ElementRef<HTMLCanvasElement>;

  private attendanceMixChart?: Chart;
  private paymentsChart?: Chart;
  private viewReady = false;
  private lastSignature = '';

  constructor(public readonly store: TrackerStoreService) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngDoCheck(): void {
    if (!this.viewReady) return;

    const signature = this.getChartSignature();
    if (signature !== this.lastSignature) {
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    this.close();
  }

  private renderCharts(): void {
    if (!this.report || !this.attendanceMixCanvas || !this.paymentsCanvas) {
      return;
    }

    this.destroyCharts();

    const missedSessions = Math.max(this.report.totalSessions - this.report.sessionsAttended, 0);
    this.attendanceMixChart = new Chart(this.attendanceMixCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Attended', 'Missed'],
        datasets: [
          {
            data: [this.report.sessionsAttended, missedSessions],
            backgroundColor: ['#4ade80', '#33403a'],
            borderColor: ['#4ade80', '#33403a']
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#c8d8ce' } }
        }
      }
    });

    const paymentLabels = this.report.payments.length
      ? this.report.payments.map(payment => this.store.formatDate(payment.date) + ' - ' + payment.label)
      : ['No payments'];
    const paymentValues = this.report.payments.length ? this.report.payments.map(payment => payment.amount) : [0];

    this.paymentsChart = new Chart(this.paymentsCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: paymentLabels,
        datasets: [
          {
            label: 'Payments Made Including Dues (Rs)',
            data: paymentValues,
            backgroundColor: this.report.payments.length
              ? this.report.payments.map(payment => (payment.kind === 'dues' ? '#f59e0b' : '#60a5fa'))
              : ['#60a5fa'],
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#c8d8ce' } }
        },
        scales: {
          x: { ticks: { color: '#9bb0a2' }, grid: { color: '#2a332e' } },
          y: { ticks: { color: '#9bb0a2' }, grid: { color: '#2a332e' } }
        }
      }
    });

    this.lastSignature = this.getChartSignature();
  }

  private destroyCharts(): void {
    this.attendanceMixChart?.destroy();
    this.paymentsChart?.destroy();
  }

  private getChartSignature(): string {
    return [
      this.report.name,
      this.report.sessionsAttended,
      this.report.totalSessions,
      this.report.totalPaid.toFixed(2),
      this.report.payments.map(payment => payment.kind + ':' + payment.label + ':' + payment.amount).join('|')
    ].join('::');
  }
}
