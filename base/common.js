//! $Id: common.js 2019.09.07 Articlejs.Libs $
//++++++++++++++++++++++++++++++++++++++++++++++
//  Project: Articlejs v0.1.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  通用基本工具集。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { beforeFixed, afterFixed } from "./base.js";
import { Scripter } from "../config.js";

const
    $ = window.$,

    // ID标识字符限定
    __reIDs = /(?:\\.|[\w-]|[^\0-\xa0])+/g;



//
// 基本类定义。
//////////////////////////////////////////////////////////////////////////////


//
// 元素选取集。
// 封装类名设置/取消逻辑。
// 注：继承自Set可获取展开特性。
//
export class ESet extends Set {
    /**
     * 创建选取元素集。
     * mark为类名，不参与节点的vary事件处理。
     * @param {String} mark 选取标记类
     */
    constructor( mark ) {
        super();
        this._cls = mark;
    }


    /**
     * 添加元素成员。
     * 会设置成员的选取标记类名。
     * @param  {Element} el 目标元素
     * @return {Element} el
     */
    add( el ) {
        super.add(
            $.addClass( el, this._cls )
        );
        return el;
    }


    /**
     * 移除元素成员。
     * 会清除成员的选取标记类名。
     * @param  {Element} el 目标元素
     * @return {Element} el
     */
    delete( el ) {
        super.delete(
            $.removeClass( el, this._cls )
        )
        return el;
    }


    /**
     * 清空集合。
     * @return {this}
     */
    clear() {
        for ( const el of this ) {
            $.removeClass( el, this._cls );
        }
        return super.clear(), this;
    }


    /**
     * 返回首个成员。
     * @return {Element|void}
     */
    first() {
        for (const el of this) return el;
    }


    //-- 批量接口 ------------------------------------------------------------
    // 主要用于外部undo/redo操作。


    /**
     * 压入元素序列。
     * 不检查原集合中是否已经存在。
     * @param  {[Element]} els 目标元素集
     * @return {ESet} 当前实例
     */
    pushes( els ) {
        els.forEach(
            el => this.add( el )
        );
        return this;
    }


    /**
     * 移除元素序列。
     * 假定目标元素已全部存在于集合内。
     * @param  {[Element]} els 目标元素集
     * @return {ESet} 当前实例
     */
    removes( els ) {
        els.forEach(
            el => this.delete(el)
        );
        return this;
    }
}


//
// 元素选取焦点。
// 封装类名设置、取消逻辑。
//
export class EHot {
    /**
     * @param {String} mark 焦点标记类
     */
    constructor( mark ) {
        this._cls = mark;
        this._its = null;
    }


    /**
     * 设置焦点元素。
     * @param  {Element|null} el 目标元素
     * @return {Element|null} 之前的焦点
     */
    set( el ) {
        let _its = this._its;
        if ( _its !== el ) this._set(el);
        return _its;
    }


    /**
     * 获取焦点元素。
     */
    get() {
        return this._its || null;
    }


    /**
     * 判断是否为焦点。
     * @param  {Element} el 测试元素
     * @return {Boolean}
     */
    is( el ) {
        return !!el && el === this._its;
    }


    /**
     * 取消焦点。
     * @return {null}
     */
    cancel() {
        if ( this._its ) {
            $.removeClass( this._its, this._cls );
        }
        return this._its = null;
    }


    /**
     * 设置焦点元素。
     * @param  {Element|null} el 目标元素
     * @return {void}
     */
    _set( el ) {
        if ( el == null ) {
            return this.cancel();
        }
        if ( this._its ) {
            $.removeClass( this._its, this._cls );
        }
        this._its = $.addClass( el, this._cls );
    }
}


//
// 元素光标类。
// 用于在编辑元素内容时定位并激活一个插入点。
// 注记：
// 通常只需要一个全局的类实例。
//
export class ECursor {
    /**
     * 内部会维护一个光标元素（实例级），
     * 用于插入占位和定位。
     * @param {String} prefix 属性名前缀
     */
    constructor( prefix = '_cursor_' ) {
        let _val = prefix +
            (Date.now() % 0xffffffff).toString(16);

        this._cel = $.attr( $.elem('i'), _val, '' );
        this._slr = `[${ _val }]`;
    }


    /**
     * 植入光标。
     * 在容器元素内植入光标占位元素。
     * 如果范围对象不在容器元素内则不会植入（返回false）。
     * @param  {Element} box 容器元素
     * @param  {Range} rng 范围对象
     * @return {Element|false} box
     */
    cursor( box, rng ) {
        let _ok = $.contains( box, rng.commonAncestorContainer );

        if ( _ok ) {
            rng.collapse( false );
            rng.insertNode( this._cel );
        }
        rng.detach();

        return _ok && box;
    }


    /**
     * 激活光标或全选。
     * 对可编辑的容器元素创建并激活一个光标。
     * 元素属性：contenteditable=true
     * 前提：
     * 实参元素应当已经包含了光标占位元素。
     * @param  {Element} el 容器元素
     * @return {Element} el
     */
    active( el ) {
        let _cur = $.get( this._slr, el ),
            _rng = document.createRange();

        if ( _cur ) {
            _rng.selectNode( _cur );
            _rng.deleteContents();
            el.normalize();
        } else {
            _rng.selectNodeContents( el );
        }
        return this._active( _rng, el );
    }


    /**
     * 激活光标到首/尾。
     * 默认激活光标到末尾。
     * @param {Element} el 容器元素
     * @param {Boolean} start 到元素内容前端，可选
     */
    active2( el, start = false ) {
        let _cur = $.get( this._slr, el ),
            _rng = document.createRange();

        if ( _cur ) {
            _cur.remove();
            el.normalize();
        }
        _rng.selectNodeContents( el )
        _rng.collapse( start );

        return this._active( _rng, el );
    }


    /**
     * 元素光标清理。
     * 移除插入的光标元素并规范化元素文本。
     * 返回false表示无占位光标元素。
     * @param  {Element} el 容器元素
     * @return {Element|false}
     */
    clean( el ) {
        let _cur = $.get( this._slr, el );

        if ( _cur ) {
            _cur.remove();
            el.normalize();
        }
        return _cur && el;
    }


    /**
     * 激活到文档。
     * @param  {Range} rng 范围对象
     * @param  {Element} box 待编辑元素
     * @return {Element} box
     */
    _active( rng, box ) {
        let _ss = window.getSelection();

        _ss.removeAllRanges();
        _ss.addRange( rng );
        rng.detach();

        return box.focus(), box;
    }

}


//
// 唯一成员集。
// 实现几个基本的数组/集合方法。
// 注记：可用于ESC逐层取消栈功能。
//
export class ArrSet extends Set {
    /**
     * 逐个入栈。
     * 重复的值会被忽略。
     * @param  {...Value} vals 值序列
     * @return {Number} 栈大小
     */
    push( ...vals ) {
        vals.forEach( v => super.add(v) );
        return this.size;
    }


    /**
     * 弹出末尾值。
     * @return {Value}
     */
    pop() {
        let _v = this.last();
        super.delete( _v );
        return _v;
    }


    /**
     * 移除头部值。
     * @return {Value}
     */
    shift() {
        let _v = this.first();
        super.delete( _v );
        return _v;
    }


    /**
     * 返回首个成员。
     */
    first() {
        for (const it of this) return it;
    }


    /**
     * 返回最后一个成员。
     */
    last() {
        let it;
        for ( it of this );
        return it;
    }
}



//
// 工具函数。
//////////////////////////////////////////////////////////////////////////////


/**
 * 是否为可视节点。
 * @param  {Node} node 测试节点
 * @return {Boolean}
 */
function visibleNode( node ) {
    let _nt = node.nodeType;

    if ( _nt === 1 ) {
        return true;
    }
    return _nt === 3 && node.textContent.trim() ? true : false;
}



//
// 基本函数集。
//////////////////////////////////////////////////////////////////////////////


/**
 * JSON 安全解析。
 * 采用Worker解析，支持任意合法的JS表示。
 * @param  {String} str 目标的字符串表示
 * @return {Promise<Object|Value>}
 */
export function parseJSON( str ) {
    let _wk = Scripter();

    return new Promise( resolve => {
        _wk.onmessage = ev => resolve(ev.data);
        _wk.postMessage( `return ${str}` );
    });
}


/**
 * 构造ID标识。
 * 提取源文本内的合法片段用短横线（-）串接。
 * @param  {String} text 源文本
 * @param  {String} prefix ID前缀
 * @return {String} 标识串
 */
export function createID( text, prefix = '' ) {
    return prefix + text.match(__reIDs).join('-');
}


/**
 * 构造日期/时间值串。
 * 由外部保证两个串的格式合法。
 * @param  {String} date 日期串，可选
 * @param  {String} time 时间串，可选
 * @return {String|null}
 */
export function dateTime( date, time ) {
    if ( time ) {
        date = date ? `${date} ${time}` : `${time}`;
    }
    return date || null;
}


/**
 * 获取节点所在父元素内下标位置。
 * 忽略空文本节点和注释节点，位置计数从0开始。
 * @param  {Node} node 目标元素
 * @return {Number} 所在下标
 */
export function siblingIndex( node ) {
    let _n = 0;
    while ( (node = node.previousSibling) ) {
        visibleNode(node) && _n ++;
    }
    return _n;
}


/**
 * 向前获取目标位置节点。
 * 位置计数仅限于可视节点（元素和非空文本节点）。
 * 固定属性单元视为端头阻挡，返回后阶节点。
 * 如果一开始就被阻挡，返回null。
 * 注记：
 * 用于移动插入到目标位置之前。
 * @param  {Node} beg 起始节点
 * @param  {Number} n 向前步进计数，可选（默认1）
 * @return {Node|null}
 */
export function prevNodeN( beg, n = 1 ) {
    let nodes = $.prevNodes( beg ),
        i = 0;

    for ( ; i < nodes.length; i++ ) {
        let _nd = nodes[i];
        if ( --n < 0 || beforeFixed(_nd) ) {
            break;
        }
    }
    return nodes[ i-1 ] || null;
}


/**
 * 是否为向前移动结束。
 * @param  {Element} el 待移动元素
 * @return {Boolean}
 */
export function prevMoveEnd( el ) {
    let _nd = $.prevNode( el );
    return !_nd || beforeFixed( _nd );
}


/**
 * 向后获取目标位置节点。
 * 说明参考同上。
 * 注记：用于移动插入到目标位置之后。
 * @param  {Node} beg 起始节点
 * @param  {Number} n 向后步进计数，可选（默认1）
 * @return {Node|null}
 */
export function nextNodeN( beg, n = 1 ) {
    let nodes = $.nextNodes( beg ),
        i = 0;

    for ( ; i < nodes.length; i++ ) {
        let _nd = nodes[i];
        if ( --n < 0 || afterFixed(_nd) ) {
            break;
        }
    }
    return nodes[ i-1 ] || null;
}


/**
 * 是否为向后移动结束。
 * @param  {Element} el 待移动元素
 * @return {Boolean}
 */
export function nextMoveEnd( el ) {
    let _nd = $.nextNode( el );
    return !_nd || afterFixed( _nd );
}


/**
 * 交换DOM中两个元素。
 * @param {Element} a 元素a
 * @param {Element} b 元素b
 */
export function elem2Swap( a, b ) {
    let _box = b.parentNode,
        _ref = b.previousSibling;

    $.replace( a, b );
    return _ref ? $.after( _ref, a ) : $.prepend( _box, a );
}
