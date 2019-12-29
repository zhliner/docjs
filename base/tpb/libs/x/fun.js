//! $Id: fun.js 2019.12.29 Tpb.X $
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//          Copyright (c) 铁皮工作室 2019 MIT License
//
//          @project: Tpb v0.3.2
//          @author:  风林子 zhliner@gmail.com
//////////////////////////////////////////////////////////////////////////////
//
//  基本功能函数。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { X } from "../lib.x.js";

/**
 * 构造Web安全色序列。
 * 每36色一个区，共分6区（视觉矩形）。
 * @return {[String]}
 */
function color216() {
	let _chs = ['0', '3', '6', '9', 'c', 'f'],
        _buf = [];

	for (let _R = 0; _R < 6; ++_R) {
		for (let _G = 0; _G < 6; ++_G) {
			for (let _B = 0; _B < 6; ++_B) {
				_buf.push( '#' + _chs[_R] + _chs[_G] + _chs[_B] );
			}
		}
	}
	return _buf;
}
