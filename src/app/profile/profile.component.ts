import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import {Router} from '@angular/router';
import {AngularFirestore} from '@angular/fire/firestore';
import {AngularFireStorage} from '@angular/fire/storage';
import {ComponentWithProfile, performSensitiveAction} from '../../utils/profile-utils';
import {AngularFireFunctions} from '@angular/fire/functions';
import {uploadTaskToPromise} from '../../utils/firebase-utils';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {Observable, Subject} from 'rxjs';
import {first, map, switchMap, take, takeUntil} from 'rxjs/operators';
import {swalLoading} from '../../utils/other-utils';
import Swal from 'sweetalert2';
import {AngularFireMessaging} from '@angular/fire/messaging';
import {Device} from '../../utils/firestore-types';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent extends ComponentWithProfile implements OnInit {
  @ViewChild('avatar') avatar: ElementRef<HTMLInputElement>;

  form = new FormGroup({
    name: new FormControl('', Validators.required),
    email: new FormControl('')
  });
  avatarPreview$ = new Subject<string>();

  showNotificationPrompt$: Observable<boolean>;

  constructor(private router: Router, afAuth: AngularFireAuth, afs: AngularFirestore,
              private storage: AngularFireStorage, private fns: AngularFireFunctions,
              private afMessaging: AngularFireMessaging) {
    super(afAuth, afs);
    this.showNotificationPrompt$ = this.afAuth.user.pipe(
      switchMap(user =>
        this.afs.doc<Device>(`profiles/${user.uid}/devices/${localStorage.getItem('deviceId')}`).valueChanges()),
      map(device => device.messagingToken == null)
    );
  }

  ngOnInit() {
    super.ngOnInit();
    this.afAuth.user.pipe(first(value => value != null), takeUntil(this.unsubscribe)).subscribe(user =>
      this.storage.storage.ref(`profiles/${user.uid}/avatar`).getDownloadURL()
        .then(avatar => this.avatarPreview$.next(avatar)));
    this.newProfile$.pipe(
      take(1),
      switchMap(() => this.profile$),
      take(1),
      takeUntil(this.unsubscribe)
    ).subscribe(profile => {
      this.form.setValue({
        name: profile.name,
        email: profile.email
      });
    });
  }

  updateAvatarPreview() {
    const reader = new FileReader();
    reader.readAsDataURL(this.avatar.nativeElement.files[0]);
    reader.addEventListener('load', () => {
      this.avatarPreview$.next(reader.result as string);
    });
  }

  async onSubmit() {
    try {
      swalLoading('Saving profile...',
        'Please wait while the changes to your profile are being saved...');
      const user = this.afAuth.auth.currentUser;
      await this.afs.doc(`profiles/${user.uid}`).update({name: this.form.value.name});
      if (this.avatar.nativeElement.files.length > 0) {
        await uploadTaskToPromise(this.storage.storage.ref(`profiles/${user.uid}/avatar`).put(this.avatar.nativeElement.files[0]));
      }
      await Swal.fire('Profile saved',
        'The changes to your profile were saved successfully.', 'success');
    } catch (e) {
      console.error(e);
      await Swal.fire('Error saving profile', e.toString(), 'error');
    }
  }

  async becomeArtist() {
    const user = this.afAuth.auth.currentUser;
    await performSensitiveAction(user, {
      title: 'Become an artist',
      action: 'become an artist',
      titlePresent: 'Becoming an artist',
      actionPresent: 'you\'re becoming an artist',
      titleDone: 'Now an artist',
      actionDone: 'You are now an artist'
    }, async () => {
      // Once you create your billing profile, replace this function with the following:
      // callAndNavigate(this.fns.functions, this.router, 'becomeArtist', ['/profile-artist'])
      await this.fns.functions.httpsCallable('becomeArtist')();
      await uploadTaskToPromise(this.storage.storage.ref(`artists/${user.uid}/avatar`).put(await (await fetch(user.photoURL)).blob()));
      await this.router.navigate(['/profile-artist']);
    });
  }

  async deleteProfile() {
    const user = this.afAuth.auth.currentUser;
    await performSensitiveAction(user, {
      title: 'Delete profile',
      action: 'delete your profile',
      titlePresent: 'Deleting profile',
      actionPresent: 'your profile is being deleted',
      titleDone: 'Profile deleted',
      actionDone: 'Your profile was deleted successfully'
    }, async () => {
      await this.fns.functions.httpsCallable('deleteProfile')();
      await this.router.navigate(['/']);
      await this.afAuth.auth.signOut();
    });
  }

  requestNotifications() {
    this.afMessaging.requestToken.subscribe({
      next: token => this.afs.doc(`profiles/${this.afAuth.auth.currentUser.uid}/devices/${localStorage.getItem('deviceId')}`)
        .update({messagingToken: token, showMessaging: false}),
      error: () => Swal.fire({
        icon: 'error',
        title: 'Permission denied',
        text: 'The notifications permission has been denied! Please go to the settings of your browser to grant it, then click this button again.'
      })
    });
  }
}
