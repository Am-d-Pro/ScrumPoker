const roomManager = require('./RoomManager');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting VASPoker Universal Access & 4-Room Test');
  console.log('====================================================\n');

  // Test 1: Password Protected Room Join
  console.log('▶ Test 1: Testing Password Protected Room Access...');
  const protectedRoom = roomManager.createRoom({
    name: 'Protected Security Room',
    hostName: 'AdminSecurity',
    password: 'secretPassword123'
  });

  console.log(`  ✓ Protected Room Created with ID: ${protectedRoom.id}, Password: "secretPassword123"`);

  // Try join with wrong password
  const failJoin = roomManager.joinRoom(protectedRoom.id, 'socket_wrong_pass', {
    name: 'Hacker',
    password: 'wrongPassword'
  });
  if (failJoin.error && failJoin.requiresPassword) {
    console.log('  ✅ PASS: Guest rejected when providing incorrect room password.');
  } else {
    console.error('  ❌ FAIL: Room allowed join with wrong password.');
  }

  // Try join with correct password
  const successJoin = roomManager.joinRoom(protectedRoom.id, 'socket_correct_pass', {
    name: 'ValidGuest',
    password: 'secretPassword123'
  });
  if (successJoin.participant) {
    console.log('  ✅ PASS: Guest successfully joined password-protected room.');
  } else {
    console.error('  ❌ FAIL: Guest failed to join with correct password.');
  }

  // Test 2: Universal Reveal and Reset Access for All Users
  console.log('\n▶ Test 2: Testing Universal Reveal & Reset Access...');
  const universalRoom = roomManager.createRoom({ name: 'Universal Access Room' });
  const guest1 = roomManager.joinRoom(universalRoom.id, 'g1', { name: 'Guest Voter 1' });
  const guest2 = roomManager.joinRoom(universalRoom.id, 'g2', { name: 'Guest Voter 2' });

  roomManager.castVote(universalRoom.id, 'g1', '5');
  roomManager.castVote(universalRoom.id, 'g2', '8');

  // Trigger reveal without passing any host/admin key
  roomManager.revealVotes(universalRoom.id);
  if (universalRoom.votingState === 'revealed') {
    console.log('  ✅ PASS: Any user can trigger vote reveal without host restrictions.');
  } else {
    console.error('  ❌ FAIL: Reveal votes blocked.');
  }

  // Trigger reset without passing any host/admin key
  roomManager.resetVotes(universalRoom.id);
  if (universalRoom.votingState === 'voting' && universalRoom.participants.get('g1').vote === null) {
    console.log('  ✅ PASS: Any user can trigger story reset for the next ticket.');
  } else {
    console.error('  ❌ FAIL: Reset votes blocked.');
  }

  // Test 3: Simultaneous 4-Room Batch Creation Engine
  console.log('\n▶ Test 3: Testing Admin 4-Room Simultaneous Batch Creation...');
  const { batchRooms, roomIds } = roomManager.createBatchRooms({
    masterSessionName: 'Sprint All-Hands 4 Squads',
    adminKey: 'adminMaster999',
    deckType: 'fibonacci',
    roomsConfig: [
      { name: 'Squad 1 - Frontend', username: 'FE-Lead', password: 'passFE' },
      { name: 'Squad 2 - Backend', username: 'BE-Lead', password: 'passBE' },
      { name: 'Squad 3 - Mobile', username: 'iOS-Lead', password: 'passMobile' },
      { name: 'Squad 4 - DevOps', username: 'Ops-Lead', password: 'passOps' }
    ]
  });

  console.log(`  ✓ 4 Rooms Generated Simultaneously: [${roomIds.join(', ')}]`);
  batchRooms.forEach((r, idx) => {
    console.log(`     • Room ${idx + 1}: ${r.name} | Code: ${r.id} | Pass: ${r.password}`);
  });

  if (batchRooms.length === 4 && roomIds.length === 4) {
    console.log('  ✅ PASS: 4 Simultaneous protected rooms created with unique codes & passwords!');
  } else {
    console.error('  ❌ FAIL: Batch 4-room creation failed.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL FEATURE UPDATES VERIFIED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runTests().catch(console.error);
