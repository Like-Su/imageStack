import face_recognition

# 加载测试图片
image = face_recognition.load_image_file("C:\\Users\\MSI-NB\\Desktop\\wallhaven-ly3jkl.jpg")

# 提取人脸位置
face_locations = face_recognition.face_locations(image)

print("检测到的人脸数量:", len(face_locations))
print("人脸位置:", face_locations)
