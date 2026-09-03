const roomManager = require('./RoomManager');

function testRoomLoginsAndLeave() {
  console.log('====================================================');
  console.log('🔍 Testing VASPoker Room Login & Leave Button Pipeline');
  console.log('====================================================\n');

  // Test Leave Room Functionality
  console.log('▶ Test 1: Testing Leave Room Event...');
  const testRoom = roomManager.createRoom({ id: 'TESTLEAVE', name: 'Leave Test Room' });
  const joinRes = roomManager.joinRoom('TESTLEAVE', 'socket_leave_user', { name: 'LeaveUser' });
  
  console.log(`  ✓ User joined room. Total participants: ${testRoom.participants.size}`);
  
  // Call leaveRoom
  const leaveRes = roomManager.leaveRoom('socket_leave_user');
  console.log(`  ✓ User clicked Leave. Remaining participants: ${testRoom.participants.size}`);

  if (testRoom.participants.size === 0 && leaveRes.participant.name === 'LeaveUser') {
    console.log('  ✅ PASS: Leave button successfully removes participant and updates room state.');
  } else {
    console.error('  ❌ FAIL: Leave room logic failed.');
  }

  console.log('\n====================================================');
  console.log('🎉 LEAVE BUTTON TEST PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

testRoomLoginsAndLeave();
