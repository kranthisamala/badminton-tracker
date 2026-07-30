import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TrackerData } from './models';

@Injectable({ providedIn: 'root' })
export class TrackerDataService {
  private readonly dataUrl = 'http://localhost:5000/data';

  constructor(private readonly http: HttpClient) {}

  loadData(): Observable<TrackerData> {
    return this.http.get<TrackerData>(this.dataUrl);
  }

  saveData(data: TrackerData): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.dataUrl, data);
  }
}
