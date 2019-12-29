import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateChild, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFirestore} from '@angular/fire/firestore';
import {take} from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivateChild {
  constructor(private router: Router, private afAuth: AngularFireAuth, private afs: AngularFirestore) {
  }

  async canActivateChild(next: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    const user = await this.afAuth.user.pipe(take(1)).toPromise();
    if (user == null) {
      return this.router.parseUrl('/signin');
    }
    return (await this.afs.firestore.doc('other/admins').get()).data()?.admins?.includes(user.uid);
  }
}
