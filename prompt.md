## Lộ trình tổng thể

| Giai đoạn | Mục tiêu                 | Kết quả phải có                                              |
| ----------- | -------------------------- | ---------------------------------------------------------------- |
| 1           | Gameplay cốt lõi         | Hai nhân vật di chuyển, đánh nhau, có máu và thắng thua |
| 2           | Combat cảm giác đã tay | Block, dash, combo, hitstop, knockback, damage scaling           |
| 3           | Kỹ năng và nhân vật   | 2 nhân vật hoàn chỉnh, kỹ năng gần/xa, ultimate, CPU      |
| 4           | Game loop                  | Menu, chọn nhân vật, 3 hiệp, luyện tập, pause              |
| 5           | Art và hiệu ứng         | Sprite, background, animation, âm thanh, UI đẹp               |
| 6           | PvE và progression        | Chương phiêu lưu, cày cấp, kỹ năng, trang bị PvE        |
| 7           | Tài khoản và lưu cloud | Guest + liên kết Google, đồng bộ tiến trình               |
| 8           | Online và rank            | 1v1 online, matchmaking, rank, leaderboard                       |

Đừng thêm online, rank, trang bị hay nhiều chủng tộc trước khi bản 1v1 offline thực sự vui và cân bằng.

## Giai đoạn 1 — Prototype chiến đấu

**Mục tiêu:** tạo trận đấu 1v1 đơn giản nhất, nhưng đã có thể chơi.

## Prompt 1.1 — Khởi tạo game

`Tạo một game đối kháng 2D 1v1 chạy trên web, giao diện tiếng Việt, phong cách arcade fantasy tối giản.  Tên game: “Võ Linh Đấu Trường”.  Yêu cầu Version 1: - Sân đấu 2D side-view, hai nhân vật đối mặt nhau. - Hai nhân vật tạm thời là hình chữ nhật màu khác nhau: Hùng màu đỏ cam, Mai màu xanh lam. - Cả hai đều có 100 HP. - Người chơi điều khiển Hùng, CPU điều khiển Mai. - Điều khiển:   - A/D: di chuyển trái/phải.   - W: nhảy.   - S: ngồi.   - J: đấm nhẹ.   - K: đấm nặng.   - L: đá.   - P: block. - CPU có hành vi đơn giản: tiến gần, lùi lại, tấn công khi ở gần, đôi khi block. - Mỗi đòn có hitbox, damage, startup, active frames, recovery, knockback và hitstun. - Có thanh máu trên đầu màn hình, đồng hồ 60 giây, hệ thống 3 hiệp thắng 2. - Khi hết thời gian, bên máu cao hơn thắng hiệp. - Khi một bên hết máu, bên còn lại thắng hiệp. - Có màn hình thắng/thua và nút chơi lại. - Chưa cần online, đăng nhập, rank, trang bị, gacha, âm thanh phức tạp hoặc art đẹp. - Ưu tiên gameplay mượt, phản hồi nhanh, code tách riêng logic chiến đấu và UI. - Dùng file JSON/config để lưu thông số nhân vật và đòn đánh.`

## Prompt 1.2 — Cân bằng combat cơ bản

`Kiểm tra và cải thiện combat core của game đối kháng 2D:  1. Mỗi đòn phải có: - Startup: thời gian trước khi đòn gây sát thương. - Active: khoảng thời gian hitbox tồn tại. - Recovery: thời gian sau đòn trước khi có thể hành động. - Range: tầm với. - Damage. - Knockback. - Hitstun. - Cooldown hoặc recovery.  2. Đòn nhẹ: - Nhanh, ít damage, ít recovery. - Phù hợp để mở combo.  3. Đòn nặng: - Chậm hơn, damage cao hơn. - Có hitstop 4-6 frame khi trúng. - Knockback mạnh hơn.  4. Đòn đá: - Tầm trung, dùng để kết thúc combo hoặc giữ khoảng cách.  5. Block: - Giảm 70% damage. - Vẫn nhận 2-5% chip damage. - Block không thể giữ vô hạn; có guard gauge, nếu cạn thì bị guard break trong 1 giây.  6. Combo: - Combo chỉ tiếp tục khi đòn trước trúng và đòn sau có thể cancel. - Damage scaling: hit 1 = 100%, hit 2 = 85%, hit 3 = 70%, hit 4 = 60%, hit 5 = 50%. - Hiển thị combo count khi combo từ 2 hit trở lên.  7. Hiệu ứng: - Hit spark khi trúng. - Screen shake nhẹ khi đòn nặng trúng. - Số damage nổi lên. - Nhân vật bị hit có animation phản ứng rõ ràng.  Đừng thêm nhân vật mới hay kỹ năng mới. Chỉ tập trung làm combat core mượt, dễ hiểu và công bằng.`

## Giai đoạn 2 — Dash, năng lượng, kỹ năng

**Mục tiêu:** thêm chiều sâu chiến đấu mà chưa làm art hay online.

## Prompt 2.1 — Dash và năng lượng

`Thêm vào game đối kháng 2D hiện tại:  1. Dash: - Phím O để dash về phía trước. - Dash nhanh, có khoảng di chuyển ngắn. - Có i-frames 4-6 frame trong lúc dash để né đòn. - Có cooldown 1-1.5 giây. - Không cho phép dash liên tục để bay quanh map.  2. Thanh năng lượng: - Tối đa 100 điểm. - Tăng khi gây damage, nhận damage và block thành công. - Không tăng khi đứng yên. - Dùng cho dash mạnh, escape hoặc ultimate.  3. Meter action: - Dash mạnh: tiêu 25 năng lượng, di chuyển xa hơn và có i-frames dài hơn. - Escape/tech: khi bị combo, tiêu 50 năng lượng để thoát khỏi combo, có cooldown. - Ultimate: tiêu 100 năng lượng.  4. Cân bằng: - Người chơi không nên có thể spam dash. - Combo quá dài phải có cơ hội thoát bằng escape. - Đòn nặng phải có rủi ro: nếu miss, đối thủ có thời gian phản đòn.  Chỉ sửa combat, không thêm nhân vật, background hay art.`

## Prompt 2.2 — Kỹ năng gần và xa

`Thêm kỹ năng cho hai nhân vật hiện có:  Mỗi nhân vật có: - 1 kỹ năng gần: phím U. - 1 kỹ năng xa: phím I. - 1 ultimate: phím O khi đủ 100 năng lượng.  Kỹ năng gần: - Damage cao hơn đòn thường. - Cooldown 4-6 giây. - Có thể dùng để mở combo hoặc kết thúc combo. - Có recovery rõ ràng nếu miss.  Kỹ năng xa: - Bắn projectile hoặc tạo đòn tầm xa. - Cooldown 5-8 giây. - Projectile có thể bị block, nhảy né hoặc dash né. - Không cho phép spam để chiếm ưu thế tuyệt đối.  Ultimate: - Chỉ dùng khi đủ 100 năng lượng. - Có animation startup rõ ràng để đối thủ có cơ hội phản ứng. - Damage lớn nhưng không nên kết liễu đối thủ full HP trong mọi tình huống. - Có hiệu ứng màn hình, flash, particle và screen shake.  Hùng — Chiến Binh Lửa: - Kỹ năng gần U: “Uy Lực Trảm” — chém mạnh phía trước, knockback mạnh. - Kỹ năng xa I: “Hỏa Cầu” — bắn quả cầu lửa bay thẳng. - Ultimate O: “Sóng Đấm Thép” — lao tới, gây nhiều hit và knockback mạnh.  Mai — Sát Thủ Phong: - Kỹ năng gần U: “Vũ Đao Xoáy” — tấn công quanh mình, chống áp sát. - Kỹ năng xa I: “Phong Kiếm” — bắn lưỡi gió xuyên qua đối thủ. - Ultimate O: “Vũ Điệu Lửa” — dash qua đối thủ, gây nhiều hit và để lại vệt lửa.  Thêm tất cả thông số đòn vào JSON/config, không hardcode trong logic gameplay.`

## Giai đoạn 3 — CPU và nhân vật

**Mục tiêu:** có CPU đáng chơi và hai nhân vật khác biệt rõ.

## Prompt 3.1 — CPU thông minh hơn

`Cải thiện AI CPU cho game đối kháng 2D.  CPU cần có state machine đơn giản: - Neutral: giữ khoảng cách, quan sát người chơi. - Approach: tiến gần khi có khoảng trống. - Attack: ra đòn khi ở trong tầm đánh. - Retreat: lùi lại sau khi ra đòn hoặc khi HP thấp. - Defend: block khi bị áp sát hoặc người chơi ra combo. - Evade: nhảy hoặc dash né projectile. - Punish: phản đòn khi người chơi miss đòn nặng hoặc kỹ năng. - Ultimate: dùng ultimate khi có cơ hội tốt, không spam.  Ba mức độ khó: - Dễ: phản ứng chậm 300-500ms, ít block, ít dùng kỹ năng, dễ bị combo. - Thường: phản ứng 150-250ms, dùng block và kỹ năng hợp lý. - Khó: phản ứng 80-150ms, block nhiều hơn, punishes đòn miss, biết giữ khoảng cách.  CPU không được: - Biết trước input người chơi. - Block mọi đòn. - Spam một đòn liên tục. - Đi lại theo đường vô lý. - Trở nên bất khả chiến bại.  Thêm chế độ chọn độ khó ở màn hình trước trận: Dễ, Thường, Khó.`

## Prompt 3.2 — Khác biệt nhân vật

`Cân bằng hai nhân vật để chúng có lối chơi khác biệt rõ ràng, không chỉ khác damage.  Hùng — Chiến Binh Lửa: - Máu 110. - Tốc độ di chuyển trung bình. - Mạnh ở cận chiến và combo ngắn. - Đòn nặng mạnh, knockback lớn. - Kỹ năng xa yếu hơn, chủ yếu để poke. - Điểm yếu: ít cơ động, khó truy đuổi người chơi nhanh.  Mai — Sát Thủ Phong: - Máu 90. - Tốc độ di chuyển nhanh. - Dash xa hơn và cooldown ngắn hơn. - Mạnh ở poke, di chuyển và truy đuổi. - Đòn nặng yếu hơn Hùng. - Điểm yếu: máu thấp, dễ bị đòn nặng và anti-air.  Yêu cầu: - Mỗi nhân vật có hitbox, hurtbox, tốc độ đòn, recovery và knockback riêng. - Không cho một nhân vật thắng tuyệt đối ở mọi khoảng cách. - Hùng mạnh khi áp sát; Mai mạnh khi giữ khoảng cách và di chuyển. - Tạo bảng cân bằng trong JSON để dễ chỉnh. - Thêm màn hình thông tin nhân vật: HP, tốc độ, vai trò, điểm mạnh, điểm yếu.`

## Giai đoạn 4 — Game loop và luyện tập

**Mục tiêu:** biến prototype thành một game có menu, có thể chơi nhiều lần.

## Prompt 4.1 — Menu và luồng game

`Thêm game loop hoàn chỉnh cho game đối kháng 2D:  1. Màn hình chính: - Tiêu đề “Võ Linh Đấu Trường”. - Nút “Bắt đầu đấu”. - Nút “Luyện tập”. - Nút “Cài đặt”. - Nút “Hướng dẫn”.  2. Màn hình chọn nhân vật: - Hai nhân vật: Hùng và Mai. - Hiển thị tên, vai trò, HP, tốc độ, điểm mạnh, điểm yếu. - Người chơi chọn nhân vật. - CPU chọn ngẫu nhiên hoặc người chơi chọn CPU. - Chọn độ khó CPU: Dễ, Thường, Khó. - Nút “Vào trận”.  3. Trận đấu: - Đếm ngược 3-2-1-FIGHT. - 3 hiệp, thắng 2 hiệp. - Đồng hồ 60 giây mỗi hiệp. - Hiển thị số hiệp thắng của mỗi bên. - Hiệu ứng K.O. khi kết thúc hiệp. - Màn hình thắng/thua cuối trận. - Nút “Chơi lại” và “Về menu”.  4. Pause: - Phím Esc hoặc nút pause. - Tiếp tục, chơi lại, về menu, bật/tắt âm thanh.  5. Lưu cài đặt: - Âm thanh on/off. - Âm lượng nhạc và hiệu ứng. - Độ khó CPU mặc định. - Lưu vào localStorage.  Không thêm đăng nhập, online, rank hay trang bị.`

## Prompt 4.2 — Training mode

`Tạo chế độ Luyện tập cho game đối kháng 2D:  1. Sân luyện tập: - Không có đồng hồ hoặc không giới hạn thời gian. - Đối thủ là training dummy đứng yên hoặc có thể bật AI đơn giản. - Có nút reset vị trí, reset máu, reset năng lượng.  2. Hiển thị thông tin: - Combo count. - Tổng damage combo. - Damage từng hit. - Hitstun còn lại. - Frame advantage đơn giản nếu có thể. - Hitbox và hurtbox khi bật debug.  3. Input display: - Hiển thị chuỗi phím người chơi vừa bấm. - Ví dụ: J -> J -> K -> I. - Giúp người chơi học combo.  4. Recording: - Cho phép ghi lại tối đa 10 giây input. - Phát lại input đã ghi để luyện phản ứng.  5. CPU dummy: - Stand: đứng yên. - Block all: luôn block. - Crouch block: block đòn thấp. - Jump: nhảy định kỳ. - CPU: hành xử như CPU thường.  Chế độ luyện tập phải giúp người chơi học combo, hiểu hitbox và kiểm tra kỹ năng.`

## Giai đoạn 5 — Art, animation, âm thanh

**Mục tiêu:** thay placeholder bằng art thật, nhưng vẫn giữ gameplay ổn định.

## Prompt 5.1 — Tạo art trong Vibecode

Mở **Media → Image**, chọn **Character**, dán prompt:

`Tạo concept art nhân vật 2D side-view cho game fighting arcade pixel-art hiện đại.  Nhân vật: Hùng — Chiến Binh Lửa. - Nhìn sang phải. - Toàn thân, đứng thẳng, tỷ lệ 3/4. - Phong cách: pixel art 32-bit, silhouette rõ ràng. - Màu chủ đạo: đỏ cam, đen, vàng. - Trang phục: võ sĩ fantasy Á Đông cách điệu, có giáp nhẹ, khăn choàng, vũ khí là găng tay chiến đấu. - Không có chữ, watermark, UI, viền khung hoặc nền màu. - Nền trong suốt. - Tỷ lệ pixel và palette phải phù hợp với game fighting 2D. - Xuất PNG.`

`Tạo concept art nhân vật 2D side-view cho game fighting arcade pixel-art hiện đại.  Nhân vật: Mai — Sát Thủ Phong. - Nhìn sang phải. - Toàn thân, đứng thẳng, tỷ lệ 3/4. - Phong cách: pixel art 32-bit, silhouette rõ ràng. - Màu chủ đạo: xanh lam, trắng, bạc, tím. - Trang phục: ninja/tinh linh cách điệu, khăn choàng ngắn, dao găm hoặc kiếm ngắn. - Không có chữ, watermark, UI, viền khung hoặc nền màu. - Nền trong suốt. - Cùng tỷ lệ pixel, cùng palette sáng tối và cùng phong cách với nhân vật Hùng. - Xuất PNG.`

`Tạo background 2D side-scrolling cho game fighting arcade, tỷ lệ 16:9, kích thước 1920x1080.  Bối cảnh: sân thượng thành phố Á Đông ban đêm, mưa nhẹ, đèn neon, biển hiệu tiếng Việt mờ, nhà cao tầng phía xa, mặt sàn đá tối có vệt nước phản chiếu ánh sáng.  Phong cách: pixel art 32-bit hiện đại, tối màu ở vùng trên, sáng hơn ở vùng sàn đấu, không quá chi tiết để nhân vật vẫn nổi bật.  Yêu cầu: - Chia thành 3 lớp: background xa, midground, foreground. - Vùng sàn đấu ở giữa khung hình, rộng và sạch. - Không có nhân vật, không có chữ đọc được, không có watermark, không có UI. - Màu nền tương phản với nhân vật màu đỏ cam và xanh lam. - Xuất PNG.`

## Prompt 5.2 — Tạo sprite animation

Dùng ảnh concept từ Vibecode, đưa vào Ludo/PixelLab/AutoSprite:

`Dùng ảnh nhân vật này làm frame gốc. Tạo sprite sheet 2D side-view, nhân vật nhìn sang phải, nền trong suốt. Kích thước frame: 128x128 pixel. Giữ nguyên thiết kế, tỷ lệ, màu sắc, trang phục và silhouette giữa mọi frame.  Tạo animation: - idle: 4 frame - run: 6 frame - jump: 4 frame - crouch: 2 frame - light punch: 4 frame - heavy punch: 6 frame - kick: 4 frame - block: 2 frame - hit: 2 frame - dash: 4 frame - skill 1: 6 frame - skill 2: 6 frame - ultimate: 8 frame - K.O.: 4 frame  Yêu cầu: - Chân nhân vật đứng ở cùng vị trí trong mỗi frame. - Không có chữ, watermark, UI, nền màu hoặc shadow dưới chân. - Palette giới hạn, màu sắc tương phản tốt trên nền tối. - Xuất PNG sprite sheet và JSON atlas.`

## Prompt 5.3 — Nạp art vào game

`Tôi đã có asset: - public/assets/characters/hung/sprite_sheet.png - public/assets/characters/hung/atlas.json - public/assets/characters/mai/sprite_sheet.png - public/assets/characters/mai/atlas.json - public/assets/backgrounds/rooftop/background.png - public/assets/backgrounds/rooftop/midground.png - public/assets/backgrounds/rooftop/foreground.png - public/assets/backgrounds/rooftop/preview.png  Hãy nạp asset vào game:  1. Tạo hệ thống sprite animation đọc atlas JSON. 2. Hỗ trợ animation: idle, run, jump, crouch, light_punch, heavy_punch, kick, block, hit, dash, skill_1, skill_2, ultimate, ko. 3. Đặt anchor ở chân nhân vật để nhân vật đứng đúng mặt đất. 4. Không scale méo sprite. 5. Cho phép thay sprite sheet mà không cần sửa logic gameplay. 6. Nếu thiếu animation, dùng placeholder hình chữ nhật màu. 7. Tách hitbox/hurtbox khỏi sprite; hitbox chỉ tính vùng tay/chân thực tế khi ra đòn. 8. Thêm background parallax 3 lớp. 9. Thêm hiệu ứng: hit spark, particle, screen shake, flash trắng, số damage nổi. 10. Thêm âm thanh: đấm, đá, block, dash, kỹ năng, ultimate, K.O., nhạc nền arcade nhẹ. 11. Không để background hoặc hiệu ứng làm giảm khả năng nhìn rõ nhân vật và hitbox.`

## Giai đoạn 6 — PvE, cày cấp, kỹ năng

**Mục tiêu:** tạo nội dung chơi dài hạn mà không phá cân bằng PvP.

## Prompt 6.1 — Chế độ phiêu lưu

`Thêm chế độ “Phiêu lưu” vào game đối kháng 2D.  1. Cấu trúc: - Có 3 chương, mỗi chương 5 màn. - Mỗi màn dùngó 1-3 kẻ địch hoặc 1 boss. - Kẻ địch có HP, AI đơn giản, pattern tấn công riêng. - Boss có 2-3 phase, đổi hành vi khi HP giảm.  2. Phần thưởng: - EXP. - Gold. - Vật phẩm trang bị. - Mảnh nhân vật hoặc mảnh kỹ năng. - Không cho phần thưởng quá mạnh để phá cân bằng PvP.  3. Skill draft roguelite: - Trước mỗi màn hoặc sau mỗi màn, người chơi chọn 1 trong 3 buff/kỹ năng tạm thời. - Ví dụ: +15% damage đòn nhẹ, dash thêm 1 lần, block hồi máu, projectile xuyên qua 1 lần, giảm cooldown 20%. - Buff chỉ áp dụng trong run hiện tại, không mang sang trận PvP ranked.  4. Progression: - Level tài khoản. - Level nhân vật. - Mở khóa kỹ năng mới theo level. - Nâng cấp kỹ năng bằng tài nguyên PvE. - Trang bị chỉ ảnh hưởng PvE, không ảnh hưởng PvP ranked.  5. UI: - Map chọn chương. - Màn chọn stage. - Màn kết quả: EXP, gold, vật phẩm nhận được. - Nút chơi lại, sang màn tiếp theo, về menu.  Ưu tiên PvE trước, PvP sau.`

## Prompt 6.2 — Trang bị và build

`Thêm hệ thống trang bị cho chế độ PvE:  1. Loại trang bị: - Vũ khí: tăng attack. - Giáp: tăng HP hoặc giảm damage. - Phụ kiện: tăng tốc độ, cooldown, energy gain, crit.  2. Độ hiếm: - Thường, Hiếm, Sử thi, Huyền thoại.  3. Chỉ số: - Attack. - HP. - Defense. - Speed. - Cooldown reduction. - Energy gain. - Crit chance. - Crit damage.  4. Set effect: - Mỗi nhân vật có thể mặc tối đa 4 món. - Có set bonus khi đủ 2 hoặc 4 món cùng bộ. - Set effect chỉ áp dụng PvE.  5. Nguyên tắc cân bằng: - PvP ranked: trang bị không ảnh hưởng chỉ số chiến đấu, chỉ thay đổi ngoại hình. - PvP thường: có thể cho buff rất nhẹ, nhưng matchmaking nên ưu tiên power tương đương. - PvE: trang bị có tác dụng mạnh để tạo cảm giác build và cày cấp.  6. UI: - Trang bị nhân vật. - So sánh chỉ số trước/sau. - Nâng cấp trang bị bằng gold và material. - Không làm gacha phức tạp trong version này.`

## Giai đoạn 7 — Tài khoản và Google

**Mục tiêu:** có nền tảng dữ liệu sạch trước khi làm online.

## Prompt 7.1 — Guest + Google

`Tạo hệ thống tài khoản cho game fighting 2D, ưu tiên trải nghiệm “chơi ngay”:  1. Khi người chơi mở game lần đầu, tự tạo tài khoản guest bằng anonymous authentication. 2. Người chơi có thể vào menu, luyện tập, PvE và cày cấp mà không cần đăng nhập. 3. Hiện nút “Liên kết Google” trong phần Cài đặt / Hồ sơ. 4. Khi liên kết Google: - Gửi ID token từ client lên backend. - Backend xác minh token: chữ ký, audience, issuer, expiry và nonce. - Nếu Google ID chưa tồn tại, liên kết Google ID với guest user hiện tại và giữ toàn bộ tiến trình. - Nếu Google ID đã tồn tại, hiển thị hộp thoại chọn giữ tiến trình hiện tại hoặc dùng tiến trình của tài khoản Google cũ; không ghi đè im lặng. 5. Sau khi liên kết, cho phép đăng nhập lại trên thiết bị khác và khôi phục profile, nhân vật, trang bị, tiến trình PvE. 6. Cho phép hủy liên kết Google, nhưng yêu cầu xác nhận và cảnh báo về việc mất khả năng khôi phục trên thiết bị khác. 7. Không cho client tự ghi trực tiếp tiền, level, trang bị, rank hoặc kết quả trận; mọi thay đổi quan trọng phải đi qua API server. 8. Giao diện tiếng Việt, có trạng thái: Đang chơi với tư cách khách, Đã liên kết Google, Đang đồng bộ, Lỗi mạng và Thử lại.`

## Prompt 7.2 — Backend và dữ liệu

`Tạo backend cho game fighting 2D:  1. Công nghệ: - API server riêng, không cho client ghi trực tiếp database. - Database quan hệ: SQL Server hoặc PostgreSQL cho user, inventory, giao dịch, kết quả trận. - MongoDB cho profile/build/nội dung game nếu cần. - Redis cho session, rank và leaderboard.  2. Bảng/collection tối thiểu: - users: user_id, display_name, created_at, status. - auth_identities: user_id, provider, provider_user_id, linked_at. - player_profiles: user_id, level, exp, gold, gems, main_character. - player_characters: user_id, character_id, level, skills, equipment. - inventory_items: user_id, item_id, quantity, equipped, rarity. - progress: user_id, chapter, stage, stars, rewards_claimed. - match_results: match_id, user_id, opponent_id, result, rating_change, created_at.  3. API: - Tạo guest user. - Liên kết Google. - Lấy profile. - Lưu tiến trình PvE. - Mở khóa/nâng cấp kỹ năng. - Trang bị/unequip trang bị. - Gửi kết quả PvE. - Gửi kết quả PvP, nhưng server phải xác thực và tính lại.  4. Bảo mật: - Mọi API ghi dữ liệu cần kiểm tra session/token và quyền user. - Server tính damage, phần thưởng, rank; client chỉ gửi input/sự kiện, không gửi kết quả cuối cùng để server tin ngay. - Rate limit các API quan trọng. - Log giao dịch currency và phần thưởng.  Không làm guild, chat, marketplace, gacha, battle pass trong giai đoạn này.`

## Giai đoạn 8 — Online và rank

**Mục tiêu:** chỉ làm khi combat, PvE và tài khoản đã ổn.

## Prompt 8.1 — 1v1 online

`Thêm chế độ 1v1 online cho game đối kháng 2D:  1. Kiến trúc: - Server authoritative cho kết quả trận, rank, phần thưởng. - Client gửi input/action, server xác thực và tính kết quả cuối cùng. - Ưu tiên rollback netcode nếu engine hỗ trợ; nếu chưa, dùng delay-based netcode đơn giản nhưng phải tối ưu latency.  2. Matchmaking: - Ưu tiên skill rating gần nhau. - Sau đó ưu tiên region/ping gần nhau. - Có thời gian tìm trận tối đa 60 giây. - Nếu không tìm được, mở rộng dần khoảng cách skill.  3. Trận đấu: - 1v1, 3 hiệp thắng 2. - Đồng bộ vị trí, animation, hitbox, HP, meter, projectile, block, dash. - Xử lý disconnect: nếu một bên mất kết nối, bên còn lại thắng sau 10-15 giây. - Không cho phép rage quit để tránh mất rank.  4. UI: - Nút “Tìm trận”. - Hiển thị ping, tên đối thủ, rank, trạng thái kết nối. - Màn hình chờ, countdown, kết quả trận, nút chơi lại.  5. Chống gian lận: - Server kiểm tra input rate, vị trí hợp lệ, damage hợp lệ. - Không tin kết quả trận do client gửi. - Log bất thường để review.  Chưa cần 2v2, co-op online, spectator, replay server hay guild.`

## Prompt 8.2 — Rank và leaderboard

`Thêm hệ thống rank cho chế độ 1v1 online:  1. Rank: - Dùng rating Glicko hoặc ELO đơn giản. - Có placement matches: 5 trận đầu để xác định rank khởi đầu. - Các bậc: Đồng, Bạc, Vàng, Bạch Kim, Kim Cương, Cao Thủ. - Mỗi bậc có 3-5 tier. - Thắng tăng rating, thua giảm rating, nhưng giảm ít hơn khi đối thủ mạnh hơn.  2. Season: - Mỗi mùa 4-8 tuần. - Reset một phần rating đầu mùa, không reset toàn bộ. - Phần thưởng theo rank cuối mùa: danh hiệu, skin, hiệu ứng, currency.  3. Leaderboard: - Top 100 toàn server. - Top theo region nếu có. - Cập nhật realtime bằng Redis Sorted Set. - Hiển thị: rank, tên, avatar, rating, số trận, win rate.  4. Chống gian lận: - Không cho client tự cộng rating. - Server tính rating dựa trên kết quả trận đã xác thực. - Phát hiện rage quit, smurf, win trading. - Có hệ thống report và review thủ công cho trường hợp nghiêm trọng.  5. UI: - Trang profile: rank hiện tại, rating, win rate, lịch sử trận. - Trang leaderboard. - Hiển thị điểm thay đổi sau mỗi trận: +18, -12.`

## Thứ tự ưu tiên khi gặp lỗi

Khi Vibecode tạo xong một phần, hãy kiểm tra theo thứ tự này:

1. **Điều khiển có mượt không?** Nhân vật phải phản hồi ngay khi bấm phím.
2. **Đòn đánh có rõ ràng không?** Người chơi phải thấy rõ khi nào trúng, khi nào miss, khi nào bị block.
3. **Combo có ý nghĩa không?** Combo phải có risk/reward, không phải spam một nút.
4. **CPU có ngu không?** CPU phải biết giữ khoảng cách, block, né và punish.
5. **Cân bằng có ổn không?** Không nhân vật nào thắng mọi khoảng cách.
6. **UI có dễ hiểu không?** Người mới phải biết mình đang làm gì mà không cần đọc hướng dẫn dài.
7. **Hiệu năng có ổn không?** Game phải chạy 60 FPS trên máy trung bình.
8. **Art có nhất quán không?** Hai nhân vật phải cùng tỷ lệ, palette và phong cách.

## Lưu ý quan trọng

- Đừng yêu cầu “làm game hoàn chỉnh” trong một prompt; hãy chia nhỏ như trên.
- Mỗi lần chỉ thêm một hệ thống, rồi chơi thử ngay.
- Giữ mọi thông số đòn đánh trong JSON/config để chỉnh cân bằng nhanh.
- Tách hitbox/hurtbox khỏi sprite; sprite đẹp nhưng hitbox sai sẽ hủy game feel.
- Không làm online trước khi combat offline vui; online sẽ phóng to mọi vấn đề cân bằng và netcode.
- Không để trang bị quyết định thắng thua PvP; hãy để kỹ năng và kỹ thuật quyết định.
- Với art, dùng Vibecode cho concept/background, còn sprite animation nên dùng Ludo/PixelLab rồi chỉnh tay trong Aseprite/Pixelorama.
