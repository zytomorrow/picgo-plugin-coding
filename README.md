# picgo-plugin-Coding

PicGo Uploader For Coding.net

### Install

```bash
npm i picgo-plugin-coding
```

~~**考虑到coding API变更，现在使用的模拟浏览器的方式进行的授权，存在一定性能损耗。
由于使用到puppeteer,不想安装完整puppeteer小伙伴可以考虑使用 [picgo-plugin-coding-lite](hhttps://github.com/zytomorrow/picgo-plugin-coding/tree/lite)**~~

**现在已接入最新版的coding API.**

### 用法
- 团队名称/项目名称: coding.net团队名称/项目名称
- 个人token: 个人token
- 仓库名称/分支: 填入仓库名和分支。可只填仓库名
- 存储结构: 默认不填为存放在根目录。floder/:date | floder/ | :date。floder为自定义文件夹名
- ~~自定义域名: 开启coding pages后的自定义域名，可不选。`后期pages迁移了后会产生CDN费用，请注意`~~ 静态部署收费了,不建议这么做了。

### Demo
![Demo](./static/demo.png)

### 版本历史

- 2022-3-2 V2.0.0
  - feta:
    - 接入CODING最新API
    - 自定义域名设置取消，后续考虑中
  - todo:
    - [ ] 部分参数重复请求，后续考虑保存至配置文件
- 老版本忘记了日期，算了，不记录了
