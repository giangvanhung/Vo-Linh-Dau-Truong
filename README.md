# Võ Linh Đấu Trường

Game đối kháng arcade fantasy 2D, chơi trực tiếp trên trình duyệt. Bản đầu tiên có trận 1v1 giữa Hùng và Mai (CPU), ba hiệp thắng hai, các đòn đánh có khung khởi động/đang đánh/hồi chiêu, block, hitbox và phản hồi trúng đòn.

## Chạy trên máy

Cần cài Node.js. Trong thư mục dự án, chạy:

```bash
npm run dev
```

Mở địa chỉ `http://localhost:5173` trong trình duyệt. Không cần cài package bên ngoài.

## Điều khiển

| Phím | Hành động |
| --- | --- |
| A / D | Di chuyển trái / phải |
| W | Nhảy |
| S | Ngồi |
| J | Đấm nhẹ |
| K | Đấm nặng |
| L | Đá |
| P (giữ) | Đỡ đòn |

## Cấu trúc

- `src/combat.js`: trạng thái nhân vật và phân xử đòn đánh.
- `src/main.js`: vòng lặp trận đấu, CPU và vẽ sân đấu.
- `data/fighters.json`: chỉ số nhân vật, sân đấu và thông số đòn đánh.
- `styles.css`, `index.html`: giao diện.
- `prompt.md`: bản prompt/kế hoạch gốc, được giữ nguyên.
