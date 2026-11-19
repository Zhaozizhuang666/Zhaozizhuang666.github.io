<table>
  <tr>
    <td width="210" align="center" valign="middle">
      <a href="https://zhaozizhuang666.github.io/"><img src="https://zhaozizhuang666.github.io/assets/profile.jpg" width="180" alt="Zizhuang Zhao by a mountain lake"></a>
    </td>
    <td valign="middle">
      <h1>Hi, I'm Zizhuang Zhao</h1>
      <p><strong>Robotics End-to-End Model Evaluation Engineer at Spirit AI</strong></p>
      <p lang="zh-CN">专注具身机器人评测与真机验证。</p>
      <p>Embodied Foundation Models · Vision-Language-Action · Real-Robot Evaluation</p>
      <p>I connect benchmark design, robot testing, failure analysis, and actionable feedback for model iteration.</p>
      <p><a href="https://zhaozizhuang666.github.io/">🏠 Personal Website</a> &nbsp;·&nbsp; <a href="https://zhaozizhuang666.github.io/#experience">🧪 Evaluation Experience</a> &nbsp;·&nbsp; <a href="https://zhaozizhuang666.github.io/vla-guide/">📘 VLA Guide</a> &nbsp;·&nbsp; <a href="mailto:zizhuang.zhao@spirit-ai.com">✉️ Email</a></p>
    </td>
  </tr>
</table>

<p align="center"><kbd>VLA Evaluation</kbd> &nbsp; <kbd>OOD Testing</kbd> &nbsp; <kbd>Robot Integration</kbd> &nbsp; <kbd>Failure Analysis</kbd></p>

## 01 · What I Do

| Evaluation architecture | Cross-robot consistency |
| --- | --- |
| Design end-to-end ELM test cases across perception, action, reasoning, learning, task execution, interaction, robustness, efficiency, generalization, and safety. | Compare task benchmarks, atomic robot capabilities, and hardware checks to trace performance differences across model, software, and robot body. |
| Bimanual and real-robot testing | Reliability and iteration |
| Run the workflow across MovaXHelper, torque-sensor calibration, Docker, Franka, RoboArena, HMI, and automated scripts. | Test Agent–VLN–VLA edge cases; verify safety stops, retry/recovery, and exception feedback, then turn results into regression and iteration evidence. |

**Evaluation path:** `Task benchmark` → `Robot capability` → `Hardware check` → `Root-cause report` → `Model iteration`

## 02 · Selected Evaluation Work

### World Robot Games · Catering Tasks

As a core integration and testing team member, I contributed to end-to-end evaluation across hot-food retrieval, microwave operations, beverage dispensing and cup delivery, food-tong handoff, and drink organization. I tested low-light corners, narrow passages, off-center tray loads, glare, and irregular props, documenting issues such as sausage-toast grasp failures, gripper oscillation, and position generalization gaps.

<sub><a href="https://mp.weixin.qq.com/s/72bqwqyHdnddDNOmFLpvYg">ifeng Tech report</a> · <a href="https://mp.weixin.qq.com/s/CKZt89C16-UYofxPEr-T1Q">Spirit AI report</a></sub>

### Lijian · Service Tasks and OOD Evaluation

Contributed to evaluation of coffee-making navigation, beverage delivery, and multimodal tea-service tasks. Pre-run checks covered robot state, sensors and calibration, voice and Agent/perception/motion service versions, SKU availability, and environment safety. Boundary tests combined constrained passages, glare, target offset or occlusion, slippery surfaces, and dense item layouts; runs tracked navigation compensation, recognition, grasp stability, placement accuracy, and per-action outcomes. Video records, standardized reports, and archived data supported review and model iteration.

### Post-Training Models · Focused Validation

Completed integration checks for catering food-tong models, a printer generalization model, and a snack-rack model. Evaluated end-to-end success, action-level accuracy, and generalization boundaries, producing standardized records for version comparison and issue investigation.

## 03 · Learning and Projects

- [VLA Guide](https://zhaozizhuang666.github.io/vla-guide/) — a structured learning resource on embodied AI, VLA methods, evaluation, and engineering practice.
- [Research and Reproduction](https://zhaozizhuang666.github.io/#research) — ongoing study of Spirit V1.5, ACT, Diffusion Policy, and OpenVLA, with official papers, project pages, and demos.
- [Personal Website](https://zhaozizhuang666.github.io/) — experience, projects, learning resources, publications, and selected activities.

## 04 · Toolkit

`Python` · `C++` · `ROS / ROS 2` · `Docker` · `PyTorch` · `TensorFlow` · `Franka` · `VLA` · `OOD Evaluation`

<details>
  <summary>中文版</summary>

### 个人简介

我在千寻智能从事机器人端到端模型评测，关注具身大模型与 VLA 在真实任务中的表现。我通过基准设计、真机测试和问题归因，为模型迭代提供依据。

### 工作方向

- **评测体系：** 覆盖感知、行动、推理、学习、任务执行、人机交互、鲁棒性、效率、泛化与安全。
- **跨机器人一致性：** 从任务基准、机器人原子能力到本体硬件检查，分析模型、软件与硬件的表现差异。
- **双臂真机测试：** 使用 MovaXHelper、力矩传感器标定、Docker、Franka、RoboArena、HMI 与自动化脚本完成测试。
- **可靠性与迭代：** 覆盖 Agent-VLN-VLA 异常场景，验证安全保护、重试恢复与异常反馈。

### 重点评测实践

#### 世界机器人运动会餐饮任务

作为第二届世界机器人运动会餐饮项目联调与测试核心成员，参与热食柜取物、微波炉操作、饮水机接水递杯、食品夹取和饮品规整测试。覆盖低照度、紧凑通道、偏载托盘、强光反光和异形道具，记录夹取失败、夹爪抖动和位置泛化偏差，为模型迭代和赛事交付提供依据。

#### 亮剑项目服务任务与 OOD 评测

参与咖啡制作导航、饮品递送和多模态茶点评测。测试前核验机器人、传感器标定、服务版本、SKU 与环境；针对通道、光照、目标偏移与遮挡、湿滑台面及密集摆放开展组合测试，通过过程记录和分动作统计支持问题复盘。

#### 后训练模型专项验证

完成餐饮食品夹多版本模型、打印机泛化模型和零食架模型对接验证，覆盖端到端成功率、分动作精度与泛化边界，并沉淀标准化测试记录。

### 技术关键词

Python · C++ · ROS / ROS 2 · Docker · PyTorch · TensorFlow · Franka · VLA · OOD 评测

### 了解更多

[个人网站](https://zhaozizhuang666.github.io/) · [VLA Guide](https://zhaozizhuang666.github.io/vla-guide/)
</details>
