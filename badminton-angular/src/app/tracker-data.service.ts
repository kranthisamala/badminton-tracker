import { Injectable } from '@angular/core';
import { addDoc, collection, doc, DocumentData, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { from, Observable } from 'rxjs';
import { db } from './firebase.config';
import { TrackerData } from './models';

@Injectable({ providedIn: 'root' })
export class TrackerDataService {
  private readonly docRef = doc(db, 'trackerData', 'main');

  loadData(): Observable<TrackerData> {
    return new Observable<TrackerData>(subscriber => {
      const unsubscribe = onSnapshot(
        this.docRef,
        snapshot => {
          if (!snapshot.exists()) {
            subscriber.error(new Error('trackerData/main document does not exist yet. Run scripts/push-data-to-firestore.js to seed it.'));
            return;
          }
          subscriber.next(snapshot.data() as TrackerData);
        },
        error => subscriber.error(error)
      );
      return unsubscribe;
    });
  }

  saveData(data: TrackerData): Observable<void> {
    return from(setDoc(this.docRef, data as DocumentData));
  }

  logAction(action: string, uid: string, username: string): Observable<void> {
    return from(
      addDoc(collection(db, 'auditLog'), {
        uid,
        username,
        action,
        timestamp: serverTimestamp()
      }).then(() => undefined)
    );
  }
}
