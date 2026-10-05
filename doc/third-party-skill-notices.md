# Thông báo skill bên thứ ba

Ba skill Claude Code được cài project-local tại `.claude/skills/` bằng Skills CLI, không cài vào hồ sơ global:

| Skill | Nguồn | Dùng cho |
| --- | --- | --- |
| `ai-seo` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/main/skills/ai-seo) | Nội dung có cấu trúc cho AI search/GEO |
| `seo-audit` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/main/skills/seo-audit) | Kiểm tra kỹ thuật/on-page SEO |
| `copywriting` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/main/skills/copywriting) | Soạn và biên tập câu chữ trang |

Nguồn công bố license MIT, copyright Corey Haines (2025). Skills CLI báo assessment `Safe` cho `ai-seo`, `copywriting`, `Low Risk` cho `seo-audit` và không báo alert Socket. Skills là hướng dẫn cho agent, không được xem là dữ liệu TRO & LAM hay bằng chứng hiệu quả thứ hạng. Nội dung số liệu/thuật toán nền tảng phải được kiểm chứng độc lập theo [hướng dẫn nội dung dự án](seo-content-guidelines.md).

## MIT License

Copyright (c) 2025 Corey Haines

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
