// SportsCoder WebSocket 방 관리 유틸리티

/**
 * 방 관리 유틸리티
 */
class RoomManager {
  constructor() {
    this.rooms = new Map();
  }
  
  /**
   * 방에 사용자 추가
   * @param {string} roomName - 방 이름
   * @param {string} socketId - 소켓 ID
   */
  joinRoom(roomName, socketId) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.rooms.get(roomName).add(socketId);
    console.log(`사용자 ${socketId}가 방 ${roomName}에 참여했습니다.`);
  }
  
  /**
   * 방에서 사용자 제거
   * @param {string} roomName - 방 이름
   * @param {string} socketId - 소켓 ID
   */
  leaveRoom(roomName, socketId) {
    if (this.rooms.has(roomName)) {
      this.rooms.get(roomName).delete(socketId);
      if (this.rooms.get(roomName).size === 0) {
        this.rooms.delete(roomName);
      }
      console.log(`사용자 ${socketId}가 방 ${roomName}에서 나갔습니다.`);
    }
  }
  
  /**
   * 방의 사용자 수 조회
   * @param {string} roomName - 방 이름
   * @returns {number} 사용자 수
   */
  getRoomSize(roomName) {
    return this.rooms.has(roomName) ? this.rooms.get(roomName).size : 0;
  }
  
  /**
   * 모든 방 정보 조회
   * @returns {Object} 방 정보
   */
  getAllRooms() {
    const roomInfo = {};
    for (const [roomName, users] of this.rooms) {
      roomInfo[roomName] = Array.from(users);
    }
    return roomInfo;
  }
}

module.exports = new RoomManager();
