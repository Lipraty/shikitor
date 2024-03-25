# Shikitor

A simple and lightweight code editor for the web.

## Features

- [ ] popup
  - [ ] relative by cursor
    - [ ] completion
    - [ ] selection text utils, like markdown utils
    - [ ] light bulb
    - [ ] placement: top, bottom, left, right
    - [ ] offset: line-start
  - [ ] relative by mouse
    - [ ] quick message
    - [ ] code preview
    - [ ] placement: top, bottom, left, right
  - [ ] absolute
    - [ ] tag text range quick access
      - [ ] eslint error
      - [ ] typo
- [ ] 键盘交互
  - [ ] emmet
  - [ ] 根据上下文，当回车的时候自动算上 tab 宽度并插入
  - [ ] cmd + /、cmd + shift + /
  - [ ] cmd x + select end 删除当前行
  - [ ] cmd [] 光标历史
  - [ ] cmd +- 折叠
  - [ ] 括号补全
    - [ ] 选择状态下自动给范围加上括号
  - [ ] cmd + f 搜索
    - [ ] 纯文本
    - [ ] 正则
    - [ ] 特定规则搜索
  - [ ] 多光标
    - [ ] option option double click
  - [ ] hint 菜单
  - [ ] 自定义快捷键
  - [ ] bugs
    - [ ] delete、backspace 的时候光标丢了
    - [ ] cmd 左 的时候不是跳到最开始的位置，是先跳到当前行的视觉长度的最前面
    - [ ] tab 操作导致无法撤回
  - [x] tab、shift + tab
- [ ] 鼠标交互
  - [ ] 点击到 span 时高亮
    - [ ] 高亮相同片段
  - [ ] cmd 点击事件
  - [ ] 多光标
    - [ ] 一个真的光标，其他的用假的假装有一个
    - [ ] option 单击
    - [ ] option shift 选中
  - [ ] 右键菜单
  - [x] 高亮闭合括号，方便确定范围
- [ ] 插件系统
  - [ ] set decorations
  - [ ] ghost text
  - [ ] inlay hints
  - [ ] hover
  - [ ] click
- [ ] 样式
  - [ ] 高亮特定行（范围）
    - [ ] 高亮当前行
  - [ ] 展示「空格、制表符」符号，当选择了某个范围的时候
  - [ ] 自定义指针样式
  - [ ] 行号宽度是固定的，太长了会有 bug
- [ ] 水槽
  - [ ] 自定义可点击、展示的按钮 icon
  - [ ] 类似彩虹括号的功能
- [ ] 插入区
  - [ ] 可以将文本拆分渲染，再在俩者之间插入节点
  - [ ] 快速查看定义
  - [ ] 展示当前行的报错信息
  - [ ] 评论
- [ ] 拆分渲染
  - [ ] 给当前代码的某一段（行内）提供其他的语法高亮
  - [ ] 或者跨行，某一个范围提供该功能
- [ ] Playground
  - [ ] 换成 react
  - [ ] 配置支持
    - [ ] tabsize
    - [ ] insert spaces
    - [ ] line number
    - [ ] 自定义插件
    - [x] 主题
    - [x] 语言
  - [x] github repo 图标
    - [ ] github 图标的主题没有跟随 editor 的主题
  - [x] 状态分享保存
    - [ ] 光标
    - [ ] 选区
    - [ ] 高亮
    - [x] 全屏状态
    - [x] 内容
    - [x] 语言
    - [x] 主题
  - [x] gist
    - [ ] gist history
    - [ ] multiple files
  - [x] 全屏
- [ ] lsp
- [ ] chrome 插件
  - [ ] 替换现有 GitHub textarea
  - [ ] 支持 issue 高亮，关联，以及 hints
- [ ] react 组件
- [ ] vue 组件

