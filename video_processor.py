import cv2
import numpy as np
import os
import requests
from io import BytesIO

class VideoProcessor:
    def __init__(self):
        self.video_url = "http://localhost:포트/video/hogak.mp4"
        self.temp_dir = "temp"
        os.makedirs(self.temp_dir, exist_ok=True)
        
    def download_video(self):
        """비디오 파일을 URL에서 다운로드"""
        try:
            response = requests.get(self.video_url)
            response.raise_for_status()
            temp_path = os.path.join(self.temp_dir, "temp_video.mp4")
            with open(temp_path, 'wb') as f:
                f.write(response.content)
            return temp_path
        except Exception as e:
            print(f"비디오 다운로드 중 오류 발생: {str(e)}")
            return None

    def process_video(self):
        """비디오 처리 메인 함수"""
        # 비디오 다운로드
        video_path = self.download_video()
        if not video_path:
            return
        
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                print("비디오를 열 수 없습니다.")
                return

            # 비디오 정보 가져오기
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            # 출력 비디오 설정
            output_path = os.path.join(self.temp_dir, "output.mp4")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # 여기에 프레임 처리 로직 추가
                processed_frame = self.process_frame(frame)
                out.write(processed_frame)

            cap.release()
            out.release()
            
            # 임시 파일 정리
            os.remove(video_path)
            
        except Exception as e:
            print(f"비디오 처리 중 오류 발생: {str(e)}")
            if os.path.exists(video_path):
                os.remove(video_path) 