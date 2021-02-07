//! $Id: coloring.js 2020.02.07 Articlejs.Libs $
//++++++++++++++++++++++++++++++++++++++++++++++++
//  Project: Articlejs v0.1.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2020 - 2021 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  代码高亮即时分析封装工具集。
//  用于高亮代码中即时编辑即时着色的场景。
//
//  这里并不提供具体语言的高亮匹配语法解析，它们由插件（/plugins/hlcolor）实现。
//  反而，这里的工具函数需要该插件的支持（Hicode.analyze）。
//
//  功能：
//
//  根据当前光标点（Range）获取当前行、当前单词。
//  也即提取 Hicode.analyze() 中的 sub 实参。
//
//  支持当前光标点所在“环境”，根据环境的不同而有不同的处理：
//  - 顶层代码环境：即可编辑元素顶层根容器，正常解析。
//  - 局部语法环境：注释内编辑不启动解析；字符串内编辑为切分解析（与顶层平级）。
//
//
//  跨行语法：
//  代码表中的单行如果包含跨行的语法，则该语法通常会不完整。
//  这样的语法有：块注释、JS的模板字符串、其它语言的多行字符串等。
//
//  这可以通过临时补齐边界字符的方式解决：
//  - 起始：末端补齐结束标识，无论用户是否删除起始标识。
//  - 中段：两端补齐边界标识，行内可能有切分解析的逻辑（如模板字符串）。
//  - 末尾：行首补齐开始标识，无论用户是否删除结束标识。
//
//  这可能对未被编辑的行产生影响，因此需要对关联行段完整解析修正。
//  这可能由Hicolor配置支持以实现通用的处理方式。
//
//
///////////////////////////////////////////////////////////////////////////////
//
