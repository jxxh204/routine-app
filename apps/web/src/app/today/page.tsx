import { AuthRequired } from '@/components/auth-required';

import { TodayView } from './today-view';

export default function TodayPage() {
  return (
    <AuthRequired>
      <TodayView />
    </AuthRequired>
  );
}
