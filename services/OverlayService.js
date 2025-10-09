// 오버레이 관련 서비스
// 이 파일은 오버레이 관련 비즈니스 로직과 데이터베이스 작업을 담당합니다.

const { SportOverlayImage, SportActiveOverlayImage } = require('../models');

class OverlayService {
  // 모든 오버레이 조회
  static async getAllOverlays() {
    try {
      // server.js의 라인 1850-1900 오버레이 조회 로직을 여기로 이동
      return { message: '오버레이 조회 서비스 - 리팩토링 중' };
    } catch (error) {
      throw new Error('오버레이 조회 중 오류가 발생했습니다.');
    }
  }

  // 특정 오버레이 조회
  static async getOverlayById(id) {
    try {
      // server.js의 라인 1900-1950 특정 오버레이 조회 로직을 여기로 이동
      return { message: `오버레이 ${id} 조회 서비스 - 리팩토링 중` };
    } catch (error) {
      throw new Error('오버레이 조회 중 오류가 발생했습니다.');
    }
  }

  // 새 오버레이 생성
  static async createOverlay(overlayData) {
    try {
      // server.js의 라인 1950-2000 오버레이 생성 로직을 여기로 이동
      return { message: '오버레이 생성 서비스 - 리팩토링 중' };
    } catch (error) {
      throw new Error('오버레이 생성 중 오류가 발생했습니다.');
    }
  }

  // 오버레이 수정
  static async updateOverlay(id, overlayData) {
    try {
      // server.js의 라인 2000-2050 오버레이 수정 로직을 여기로 이동
      return { message: `오버레이 ${id} 수정 서비스 - 리팩토링 중` };
    } catch (error) {
      throw new Error('오버레이 수정 중 오류가 발생했습니다.');
    }
  }

  // 오버레이 삭제
  static async deleteOverlay(id) {
    try {
      // server.js의 라인 2050-2100 오버레이 삭제 로직을 여기로 이동
      return { message: `오버레이 ${id} 삭제 서비스 - 리팩토링 중` };
    } catch (error) {
      throw new Error('오버레이 삭제 중 오류가 발생했습니다.');
    }
  }
}

module.exports = OverlayService;
