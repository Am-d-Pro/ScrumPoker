const roomManager = require('./RoomManager');

function testRoomLogins() {
  console.log('====================================================');
  console.log('🔍 Testing Room Login & Authentication Pipeline');
  console.log('====================================================\n');

  // Initialize the 4 constant rooms
  const { batchRooms } = roomManager.createBatchRooms({
    masterSessionName: 'Engineering Sprint',
    adminKey: 'admin123',
    roomsConfig: [
      { code: 'COASTBUSTER', name: 'Squad Coastbuster', password: 'pass1' },
      { code: 'FIPSTER', name: 'Squad Fipster', password: 'pass2' },
      { code: 'LICENSING', name: 'Squad Licensing', password: 'pass3' },
      { code: 'DAREDEVIL', name: 'Squad Daredevil', password: 'pass4' }
    ]
  });

  const testCases = [
    { code: 'COASTBUSTER', pass: 'pass1', expectSuccess: true },
    { code: 'FIPSTER', pass: 'pass2', expectSuccess: true },
    { code: 'LICENSING', pass: 'pass3', expectSuccess: true },
    { code: 'DAREDEVIL', pass: 'pass4', expectSuccess: true },
    { code: 'COASTBUSTER', pass: 'wrongpass', expectSuccess: false }
  ];

  let passed = 0;

  testCases.forEach((tc, idx) => {
    const result = roomManager.joinRoom(tc.code, `socket_user_${idx}`, {
      name: `User_${idx}`,
      password: tc.pass
    });

    if (tc.expectSuccess && result.participant) {
      console.log(`  ✅ [PASS] Room "${tc.code}": Successfully logged in with password "${tc.pass}".`);
      passed++;
    } else if (!tc.expectSuccess && result.error) {
      console.log(`  ✅ [PASS] Room "${tc.code}": Correctly blocked unauthorized login with wrong password "${tc.pass}".`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Room "${tc.code}": Unexpected result. Error:`, result.error);
    }
  });

  console.log('\n====================================================');
  if (passed === testCases.length) {
    console.log('🎉 ALL 4 ROOM LOGINS WORKING PERFECTLY!');
  } else {
    console.log('⚠️ Some login tests failed.');
  }
  console.log('====================================================\n');
}

testRoomLogins();
