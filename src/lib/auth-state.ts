import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

let currentUser: User | null = null;
let onUserChangeCallback: ((user: User | null) => void) | null = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (onUserChangeCallback) {
    onUserChangeCallback(user);
  }
});

export const getCurrentUser = () => currentUser;
export const onUserChange = (callback: (user: User | null) => void) => {
  onUserChangeCallback = callback;
};
