# Tài liệu BioGenesis

- `guides/`: hướng dẫn học và thiết lập dịch vụ.
- `architecture/`: mô hình dữ liệu và thiết kế hệ thống.
- `reviews/`: đánh giá ứng dụng và ghi nhận kiểm tra nhập Geneious.

Một số tài liệu nội bộ chỉ có trên máy phát triển và được loại khỏi Git.

## Cấu hình dự án

- `config/env/`: `.env`, `.env.local` và `.env.example`. Vite và Vitest nạp biến từ thư mục này.
- Biến môi trường trên dịch vụ deploy vẫn được thiết lập qua dashboard của dịch vụ.
- `package.json`, `package-lock.json`: giữ ở gốc để npm cài đặt và chạy đúng.
- `jsconfig.json`: giữ ở gốc để VS Code nhận diện dự án JavaScript.
- `vercel.json`: giữ ở gốc để Vercel tự nhận cấu hình triển khai.
- Các cấu hình JavaScript của Vite, Vitest và ESLint giữ tại vị trí tự nhận diện của công cụ.

Không đưa tệp chứa thông tin bí mật vào Git. Khi đổi đường dẫn env, khởi động lại dev server đang chạy.
