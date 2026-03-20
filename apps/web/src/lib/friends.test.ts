import { describe, expect, it } from 'vitest';

import { splitFriendRequests, type FriendRequestRow } from './friends';

describe('friends', () => {
  it('pending 요청을 받은/보낸 항목으로 분리한다', () => {
    const me = 'me';
    const rows: FriendRequestRow[] = [
      { id: '1', requester_id: 'me', addressee_id: 'u2', status: 'pending', created_at: '' },
      { id: '2', requester_id: 'u3', addressee_id: 'me', status: 'pending', created_at: '' },
      { id: '3', requester_id: 'u4', addressee_id: 'me', status: 'accepted', created_at: '' },
    ];

    const split = splitFriendRequests(rows, me);

    expect(split.outgoingPending.map((r) => r.id)).toEqual(['1']);
    expect(split.incomingPending.map((r) => r.id)).toEqual(['2']);
    expect(split.accepted.map((r) => r.id)).toEqual(['3']);
  });
});
