//! $Id: factory.js 2019.09.07 Articlejs.Libs $
//
// 	Project: Articlejs v0.1.0
//  E-Mail:  zhliner@gmail.com
// 	Copyright (c) 2017 - 2019 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//	内容单元创建工厂。
//
//  文章
//  - 要件：页标题（h1），副标题（h2，可选）。
//  - 附件：提要、目录、另参见、文献参考。
//  - 内容：片区集或内容集（互斥）。
//
//  片区
//  - 要件：标题（h2~h6）。
//  - 附件：（无）
//  - 内容：子片区集或内容集（互斥）。
//
//  片区集
//  片区的无序并列集，是一个独立的逻辑单元。
//  - 附件：导言、结语。
//
//  内容集
//  内容件的无序并列集，是一个独立的逻辑单元。
//  - 附件：导言、结语。
//
//  ---------------------------------------------
//
//  内容件：
//  独立的内容单元，标题仅是一个可选的部分（非要件）。
//
//  内容行：
//  可直接包含文本节点的行块元素，包括<td>和<th>。
//
//
///////////////////////////////////////////////////////////////////////////////
//

const $ = window.$;


const
    // 片区标题选择器。
    __hxSlr = 'h2,h3,h4,h5,h6',

    // 小区块标题获取。
    __hxBlock = '>h3, >h4, >summary',

    // 内容设置时的有效方法。
    __contentMeths = ['append', 'prepend', 'fill'],

    // 表格行设置时的有效方法。
    __trMeths = ['before', 'after', 'fill', 'replace'],

    // 简单标签。
    // 含role定义配置。
    __reTag = /^[a-z][a-z:]*$/,

    // 表格实例缓存。
    // { Element: $.Table }
    __tablePool = new WeakMap();


//
// 单元映射 {
//      name: tags
// }
// name: 内容名称。用于创建内容时标识区分。
// tags: 内容元素序列，固定结构。
//      /   斜线分隔父子单元
//      :   冒号分隔角色定义（role）
//      ,   逗号分隔并列单元
// 注：
// 固定结构限于可选而非可变（如<li>就不属于）。
// 表格元素单独处理，因此其子结构元素不在此列。
//
const tagsMap = {

    // 块容器
    // ------------------------------------------
    Hgroup:     'hgroup',
    Abstract:   'header:abstract/h3',
    Toc:        'nav:toc/h4, Cascade',
    Seealso:    'ul:seealso',
    Reference:  'ol:reference',
    Header:     'header/h4',
    Footer:     'footer/h4',
    Article:    'h1, article',
    S1:         'h2, section:s1',
    S2:         'h3, section:s2',
    S3:         'h4, section:s3',
    S4:         'h5, section:s4',
    S5:         'h6, section:s5',
    Ul:         'ul',
    Ol:         'ol',
    Cascade:    'ol:cascade',
    Codelist:   'ol:codelist',
    Dl:         'dl',
    Table:      'table',  // 单独处理！
    Figure:     'figure/figcaption',
    Blockquote: 'blockquote/h4',
    Aside:      'aside/h4',
    Details:    'details/summary',
    Codeblock:  'pre:codeblock/code',


    // 块内容
    // ------------------------------------------
    P:          'p',
    Address:    'address',
    Pre:        'pre',
    Hr:         'hr',
    Space:      'div:space',


    // 结构单元
    // ------------------------------------------
    Li:         'li',
    Codeli:     'li/code',
    Ali:        'li/a',
    Cascadeli:  'li/h5, ol',
    Dt:         'dt',
    Dd:         'dd',
    H1:         'h1',
    H2:         'h2',
    H3:         'h3',
    H4:         'h4',
    H5:         'h5',
    H6:         'h6',
    Figcaption: 'figcaption',
    Summary:    'summary',
    Track:      'track',
    Source:     'source',
    Rb:         'rb',
    Rp:         'rp',
    Rt:         'rt',


    // 行内单元
    // ------------------------------------------
    Audio:      'audio',
    Video:      'video',
    Picture:    'picture/img',
    A:          'a',
    Strong:     'strong',
    Em:         'em',
    Q:          'q',
    Abbr:       'abbr',
    Cite:       'cite',
    Small:      'small',
    Time:       'time',
    Del:        'del',
    Ins:        'ins',
    Sub:        'sub',
    Sup:        'sup',
    Mark:       'mark',
    Code:       'code',
    Orz:        'code:orz',
    Ruby:       'ruby',
    Dfn:        'dfn',
    Samp:       'samp',
    Kbd:        'kbd',
    S:          's',
    U:          'u',
    Var:        'var',
    Bdo:        'bdo',
    Meter:      'meter',
    B:          'b',
    I:          'i',
    Img:        'img',
    Blank:      'span:blank',
};


//
// 文章。
// 封装文章顶层对象的位置规则（不含<article>内部）。
// 前端：主标题（h1必要），副标题（h2可选）。
// 平级前端：提要、目录（可选）。
// 平级后端：另参见、文献参考（可选）。
// 子级内容：片区集或内容集，互斥关系。
// 注：
// 文章元素本身是基础参照，不可删除。
// 如果有副标题，主副标题顺序存放在一个<hgroup>之内。
//
class Article {
    /**
     * 构建文章实例。
     * ael需要已经存在于DOM中或拥有父元素。
     * @param {Element} ael 文章元素
     */
    constructor( ael ) {
        let _h1 = $.get('h1', ael.parentElement),
            _h2 = _h1 && _h1.nextElementSibling;

        this._h1 = _h1;
        this._h2 = _h2 && $.is(_h2, 'h2') ? _h2 : null;

        this._toc = $.prev(ael, 'nav[role=toc]');
        this._abstract = $.prev(ael, 'header[role=abstract]');

        this._article = ael;

        this._seealso = $.next(ael, 'ul[role=seealso]');
        this._reference = $.next(ael, 'ol[role=reference]')

        // 标题组（/h1,h2）
        this._hgroup = this._h2 && this._h2.parentElement;
    }


    /**
     * 获取/设置主标题。
     * 设置时若无标题，会新建一个。
     * 传递code为null会删除标题元素。
     * 返回标题元素，不论是删除、设置还是新建。
     * @param  {Node|[Node]} cons 标题内容
     * @param  {String} meth 内容插入方法
     * @return {Element}
     */
    h1( cons, meth = 'fill' ) {
        if ( cons === undefined ) {
            return this._h1;
        }
        return this._setH1( this._h1, cons, meth );
    }


    /**
     * 获取/设置副标题。
     * 参数说明参考.h1()。
     * @param  {Node|[Node]} cons 标题内容
     * @param  {String} meth 内容插入方法
     * @return {Element}
     */
    h2( cons, meth = 'fill' ) {
        if ( cons === undefined ) {
            return this._h2;
        }
        return this._setH2( this._h2, cons, meth );
    }


    /**
     * 获取/插入提要单元。
     * 传递el为null会删除提要单元（并返回）。
     * 如果本来就没有提要，会返回null。
     * 注：
     * 封装插入位置规则。
     * 仅支持一个提要单元，多出的插入会抛出异常。
     * 下类同。
     * @param  {Element} el 提要元素
     * @return {Element|null|void} 提要元素
     */
    abstract( el ) {
        if ( el === undefined ) {
            return this._abstract;
        }
        return this._annexSet('_abstract', el, 'before', this._toc || this._article);
    }


    /**
     * 获取/插入目录单元。
     * 传递el为null会删除目录单元（并返回）。
     * 位置：内容（<article>）之前。
     * @param  {Element} el 目录元素
     * @return {Element|null|void} 目录元素
     */
    toc( el ) {
        if ( el === undefined ) {
            return this._toc;
        }
        return this._annexSet('_toc', el, 'before', this._article);
    }


    /**
     * 获取/插入另参见单元。
     * 传递el为null会删除另参见单元（并返回）。
     * 位置：内容（<article>）之后。
     * @param  {Element} el 目录元素
     * @return {Element|null|void} 目录元素
     */
    seealso( el ) {
        if ( el === undefined ) {
            return this._seealso;
        }
        return this._annexSet('_seealso', el, 'after', this._article);
    }


    /**
     * 获取/插入参考单元。
     * 传递el为null会删除参考单元（并返回）。
     * 位置：另参见或内容之后。
     * @param  {Element} el 参考元素
     * @return {Element|null|void} 参考元素
     */
    reference( el ) {
        if ( el === undefined ) {
            return this._reference;
        }
        return this._annexSet(
            '_reference', el, 'after', this._seealso || this._article
        );
    }


    //-- 私有辅助 ------------------------------------------------------------


    /**
     * 设置主标题。
     * 没有标题时新建一个，插入最前端或副标题之前（如果有）。
     * @param  {Element|null} h1 原主标题
     * @param  {Node|[Node]} cons 标题内容
     * @param  {String} meth 内容插入方法
     * @return {Element} 主标题元素
     */
    _setH1( h1, cons, meth ) {
        if ( !h1 ) {
            this._h1 = $.prepend(
                this._hgroup || this._article.parentElement,
                $.Element('h1')
            );
        }
        return $[meth]( this._h1, cons ), this._h1;
    }


    /**
     * 设置副标题。
     * 没有副标题时新建一个h2标题。
     * 副标题会要求一个标题组（<hgroup>），如果没有会新建。
     * 注：副标题必须在主标题存在的情况下才能创建。
     * @param  {Element|null} h2 原副标题
     * @param  {Node|[Node]} cons 标题内容
     * @param  {String} meth 内容插入方法
     * @return {Element} 副标题元素
     */
    _setH2( h2, cons, meth ) {
        if ( !h2 ) {
            if ( !this._hgroup ) {
                this._hgroup = $.prepend( this._article.parentElement, $.Element('hgroup') );
                // 移动<h1>
                // 如果主标题不存在会出错。
                $.append( this._hgroup, this._h1 );
            }
            this._h2 = $.append( this._hgroup, $.Element('h2') );
        }
        return $[meth]( this._h2, cons ), this._h2;
    }


    /**
     * 设置/插入目标附件。
     * 传递el为null，会移除目标单元（并返回）。
     * @param {String} name 附件名
     * @param {Element|null} el 待插入附件元素
     * @param {String} meth 插入方法
     * @param {Element} ref 插入参考
     */
    _annexSet( name, el, meth, ref ) {
        if ( el === null ) {
            let _re = this[name];
            this[name] = null;
            return _re && $.detach( _re );
        }
        if ( this[name] ) {
            throw new Error( `[${name.substring(1)}] is already exist.` );
        }
        this[name] = $[meth]( ref, el );
    }

}


//
// 内容设置函数集。
// 如果内容传递为null表示忽略。
// 返回新插入的行块内容或行容器元素（新内容为内联节点集）。
// 注：
// 适用create创建的结构空元素和选取的目标元素。
// 源数据为两种：外部保证的最适配元素，或内联节点集。
// 参数规则：
// (目标, 标题&内容, 方法, 其它参数)
//////////////////////////////////////////////////////////////////////////////
//
const Content = {
    /**
     * 获取有效的内容插入方法名。
     * 返回false表示方法无效。
     * @param  {String} cname 内容名称
     * @param  {String} meth 插入方法
     * @return {String|false}
     */
    method( cname, meth ) {
        if ( cname == 'Tr' ) {
            return trMeth( meth );
        }
        return __contentMeths.include(meth) && meth;
    },


    /**
     * 目录构建。
     * 约束：片区必须紧随其标题元素。
     * 目标标签为节点类型，故可支持事件绑定或简单设置为主标题锚点。
     * @param  {Element} article 文章元素
     * @param  {Node|[Node]} label 目录标签（h4/..）
     * @return {Element} 目录根元素
     */
    Toc( article, label ) {
        let _toc = create( 'Toc' );

        $.append(
            _toc.firstElementChild,
            label || $.Text('Contents')
        );
        return tocList( _toc.lastElementChild, article );
    },


    /**
     * 文章结构。
     * article/[h2, section:s1]...
     * 文章内容包含章片区集或内容件集（互斥关系）。
     * 原为章片区：
     *  - 新章片区：简单添加，外部同级保证。
     *  - 新内容件：新建一章片区封装插入。
     * 原为内容件：
     *  - 新章片区：新建一章片区封装原内容件，在meth的反方向。
     *  - 新内容件：简单添加（meth）。
     * meth: prepend|append|fill
     * 注：
     * 片区占优（内容可被封装为片区，反之则不行）。
     * 标题内容的插入方法为填充（fill，下同）。
     *
     * @param  {Element} ael 文章元素
     * @param  {Node|[Node]} h1 主标题内容
     * @param  {[Element]} cons 章片区集或内容件集
     * @param  {String} meth 内容插入方法
     * @param  {Boolean} conItem 内容是否为内容件集，可选
     * @return {[Element]} 新插入的片区或内容件集
     */
    Article( ael, [h1, cons], meth, conItem ) {
        if ( h1 != null ) {
            blockHeading( 'h1', ael.parentElement, h1, meth );
        }
        if ( conItem == null ) {
            conItem = contentItems(cons);
        }
        return sectionContent( ael, cons, meth, 'S1', conItem );
    },


    /**
     * 章片区。
     * 主结构：section:s1/[h2, section:s2]...
     * 内容仅限于子片区集或内容件集（外部保证）。
     * meth: prepend|append|fill
     * 传递标题为null表示忽略（不改变），其返回值项也为null。
     * @param  {Element} sect 章容器元素
     * @param  {Node|[Node]} h2 章标题内容（兼容空串）
     * @param  {[Element]} cons 子片区集或内容件集
     * @param  {String} meth 内容插入方法
     * @param  {Boolean} conItem 内容是否为内容件集，可选
     * @return {[Element|null, [Element]]} 章标题和新插入的内容集
     */
    S1( sect, [h2, cons], meth, conItem ) {
        if ( conItem == null ) {
            conItem = contentItems(cons);
        }
        if ( h2 != null ) {
            h2 = sectionHeading( 'h2', sect, h2, meth );
        }
        return [h2, sectionContent( sect, cons, meth, 'S2', conItem )];
    },


    /**
     * 节片区。
     * 主结构：section:s2/[h3, section:s3]...
     * 参数说明参考.S1(...)接口。
     */
    S2( sect, [hx, cons], meth, conItem ) {
        if ( conItem == null ) {
            conItem = contentItems(cons);
        }
        if ( hx != null ) {
            hx = sectionHeading( 'h3', sect, hx, meth );
        }
        return [hx, sectionContent( sect, cons, meth, 'S3', conItem )];
    },


    /**
     * 区片区。
     * 主结构：section:s3/[h4, section:s4]...
     * 参数说明参考.S1(...)接口。
     */
    S3( sect, [hx, cons], meth, conItem ) {
        if ( conItem == null ) {
            conItem = contentItems(cons);
        }
        if ( hx != null ) {
            hx = sectionHeading( 'h4', sect, hx, meth );
        }
        return [hx, sectionContent( sect, cons, meth, 'S4', conItem )];
    },


    /**
     * 段片区。
     * 主结构：section:s4/[h5, section:s5]...
     * 参数说明参考.S1(...)接口。
     */
    S4( sect, [hx, cons], meth, conItem ) {
        if ( conItem == null ) {
            conItem = contentItems(cons);
        }
        if ( hx != null ) {
            hx = sectionHeading( 'h5', sect, hx, meth );
        }
        return [hx, sectionContent( sect, cons, meth, 'S5', conItem )];
    },


    /**
     * 末片区。
     * 主结构：section:s5/conitem...
     * 注：内容只能插入内容件集。
     * @param  {Element} sect 片区容器元素
     * @param  {Node|[Node]} h6 末标题内容
     * @param  {[Element]} cons 内容件集
     * @param  {String} meth 内容插入方法
     * @return {[Element|null, [Element]]} 末标题和新插入的内容件集
     */
    S5( sect, [h6, cons], meth ) {
        if ( h6 != null ) {
            h6 = sectionHeading( 'h6', sect, h6, meth );
        }
        return [h6, $[meth]( sect, cons )];
    },


    /**
     * 表格结构。
     * @param  {Element} tbl 表格元素
     * @param  {Node|[Node]} cap 表标题内容
     * @param  {[Node|[Node]]} cons 单元格内容集
     * @param  {String} meth 表格行插入方法
     * @return {Collector} 新插入内容的单元格集
     */
    Table( tbl, [cap, cons], meth ) {
        tbl = tableObj( tbl );

        if ( cap != null ) {
            tbl.caption( cap );
        }
        return tableCells(
                tbl,
                meth,
                Math.ceil(cons.length / tbl.cols()),
                'body'
            )
            .fill(cons).end();
    },


    /**
     * 表头结构（tHead）。
     * @param  {Element} thead 表头元素
     * @param  {[Node|[[Node]]]} cons 单元格内容集
     * @param  {String} meth 表格行插入方法
     * @return {Collector} 新插入内容的单元格集
     */
    Thead( thead, cons, meth ) {
        let _tbo = tableObj(
                $.closest(thead, 'table')
            );

        return tableCells(
                _tbo,
                meth,
                Math.ceil(cons.length / _tbo.cols()),
                'head'
            )
            .fill(cons).end();
    },


    /**
     * 表体结构（tBody）。
     * 支持表格内非唯一表体单元。
     * @param  {Element} tbody 表体元素
     * @param  {[Node|[[Node]]]} cons 单元格内容集
     * @param  {String} meth 表格行插入方法
     * @return {Collector} 新插入内容的单元格集
     */
    Tbody( tbody, cons, meth ) {
        let _tbo = tableObj(
                $.closest(tbody, 'table')
            );

        return tableCells(
                _tbo,
                meth,
                Math.ceil(cons.length / _tbo.cols()),
                'body',
                tbodyIndex(_tbo, tbody)
            )
            .fill(cons).end();
    },


    /**
     * 表脚结构（tFoot）。
     * @param  {Element} tfoot 表脚元素
     * @param  {[Node|[[Node]]]} cons 单元格内容集
     * @param  {String} meth 表格行插入方法
     * @return {Collector} 新插入内容的单元格集
     */
    Tfoot( tfoot, cons, meth ) {
        let _tbo = tableObj(
                $.closest(tfoot, 'table')
            );

        return tableCells(
                _tbo,
                meth,
                Math.ceil(cons.length / _tbo.cols()),
                'foot'
            )
            .fill(cons).end()
    },


    /**
     * 表格行结构。
     * meth:
     * - fill 为内部单元格填充，内容不足时后部单元格原样保持。
     * - append 效果与after方法相同，不会改变列大小。
     * - prepend 效果与before方法相同。
     * 注：参考当前行克隆，行元素上绑定的事件处理器也会同时克隆。
     * @param  {Element} tr 表格行
     * @param  {[Node]|[[Node]]} cons 单元格内容集
     * @param  {String} meth 插入方法（fill|append|prepend）
     * @return {Collector} 新插入的内容单元格集
     */
    Tr( tr, cons, meth ) {
        if ( meth == 'fill' ) {
            return $(tr.cells).fill(cons).end();
        }
        let _trs = trClone(
                tr,
                Math.ceil(cons.length / tr.cells.length),
                true
            ),
            _meth = trMeth( meth );

        return $( $[_meth](tr, _trs) ).find('th,td').flat().fill(cons).end();
    },


    /**
     * 插图。
     * 结构：figure/figcaption, p/img...
     * 仅认可首个图片容器元素（<p>）。
     * @param  {Element} root 插图根元素
     * @param  {Node|[Node]|''} cap 标题内容
     * @param  {Element|[Element]} imgs 图片/媒体节点集
     * @param  {String} meth 图片插入方法（prepend|append|fill）
     * @return {[Element]} 新插入的图片集
     */
    Figure( root, [cap, imgs], meth ) {
        if ( cap != null ) {
            blockHeading( 'figcaption', root, cap, meth );
        }
        return $[meth]( $.get('p', root), imgs );
    },


    /**
     * 标题组。
     * 结构：hgroup/h1, h2
     * 固定结构，标题内容修改为填充（fill）方式。
     * 设置内容为null可忽略修改。
     * 注：若标题不存在会自动创建（修复友好）。
     * @param  {Element} root 标题组容器
     * @param  {Node|[Node]|''} h1c 页面主标题内容
     * @param  {Node|[Node]|''} h2c 页面副标题内容
     * @return {[Element, Element]} 主副标题对
     */
    Hgroup( root, [h1c, h2c] ) {
        let _h1 = $.get( '>h1', root ),
            _h2 = $.get( '>h2', root );

        if ( !_h1 ) {
            _h1 = $.prepend( $.Element('h1') );
        }
        if ( !_h2 ) {
            _h2 = $.append( $.Element('h2') );
        }
        if ( h1c != null ) $.fill( _h1, h1c );
        if ( h2c != null ) $.fill( _h2, h2c );

        return [ _h1, _h2 ];
    },


    /**
     * 链接列表项。
     * 结构：li/a
     * 主要用于目录的普通条目。
     * @param  {Element} li 列表项
     * @param  {Node|[Node]} cons 链接内容
     * @param  {String} meth 插入方法
     * @return {Element} 列表项元素
     */
    Ali( li, cons, meth ) {
        return insertLink( li, cons, meth ), li;
    },


    /**
     * 列表标题项。
     * 结构：h5/a
     * 主要用于目录里子级列表的标题项。
     * @param  {Element} h5 列表标题项
     * @param  {Node|[Node]} cons 插入内容
     * @param  {String} meth 插入方法
     * @return {Element} h5
     */
    H5a( h5, cons, meth ) {
        return insertLink( h5, cons, meth ), h5;
    },


    /**
     * 级联编号表子表项。
     * 结构：li/h5, ol
     * 内容子列表内的条目与目标子列表执行合并。
     * 子表标题为fill插入方式。
     * @param  {Element} li 列表项
     * @param  {Node|[Node]} h5c 子表标题内容
     * @param  {Element|[Element]} list 内容子列表或列表项集
     * @param  {String} meth 插入方法（prepend|append|fill）
     * @return {Element} 子列表
     */
    Cascadeli( li, [h5c, list], meth ) {
        if ( h5c != null ) {
            blockHeading( 'h5', li, h5c, meth );
        }
        let _ol = $.get( '>ol', li );

        if ( !_ol ) {
            _ol = $.append( li, $.Element('ol') );
        }
        return list && listMerge( _ol, list, meth ), _ol;
    },


    /**
     * 注音。
     * 结构：ruby/rb,rp.Left,rt,rp.Right
     * 不管原始内容，这里仅是添加一个合法的子单元。
     * 注：现代版浏览器可能不需要rp实参。
     * @param  {Element} root 注音根元素
     * @param  {String} rb 注音目标
     * @param  {String} rt 注音内容
     * @param  {[String, String]} rp 注音包围（左,右）
     * @return {Element} root
     */
    Ruby( root, [rb, rt, rp], meth ) {
        rp = rp || [];

        $[meth](root, [
            $.Element( 'rb', rb ),
            rp[0] && $.Element( 'rp', rp[0] ),
            $.Element( 'rt', rt ),
            rp[1] && $.Element( 'rp', rp[1] ),
        ]);
        return root;
    },

};


//
// 标题区块（/heading, content）
// 标题为填充方式，内容支持方法指定：{
//      append|prepend|fill
// }
// 注：
// 方法不可以为 before|after|replace。
// 由外部保证内容单元的合法性。
///////////////////////////////////////
[
    ['Abstract',    'h3'],
    ['Header',      'h4'],
    ['Footer',      'h4'],
    ['Blockquote',  'h4'],
    ['Aside',       'h4'],
    ['Details',     'summary'],
]
.forEach(function( its ) {
    /**
     * 传递标题为null表示忽略。
     * @param  {Element} root 内容根元素
     * @param  {Node|[Node]} hx 标题内容
     * @param  {Element|[Element]} 合法的内容元素（集）
     * @param  {String} meth 内容插入方法
     * @return {[Element|null, [Element]]} 标题项和新插入的内容单元
     */
    Content[ its[0] ] = function( root, [hx, cons], meth ) {
        if ( hx != null ) {
            blockHeading( its[1], root, hx, meth );
        }
        return [ insertBlock(root, cons, meth), cons ];
    };
});


//
// 简单结构容器（一级子单元）。
// 注：由外部保证内容单元的合法性。
///////////////////////////////////////
[
    // 列表
    'Seealso',
    'Reference',
    'Ul',
    'Ol',
    'Cascade',  // Ali|Cascadeli 项
    'Codelist', // Codeli
    'Dl',       // dt,dd任意混合
]
.forEach(function( name ) {
    /**
     * @param  {Element} box 容器元素
     * @param  {Element|[Element]} 列表项元素（集）
     * @param  {String} meth 插入方法（append|prepend|fill）
     * @return {[Element]} 新插入的列表项元素（集）
     */
    Content[ name ] = function( box, cons, meth ) {
        return cons && $[meth]( box, cons );
    };
});


//
// 简单容器。
// 子内容简单填充，无结构。
// 注：由外部保证内容单元的合法性。
///////////////////////////////////////
[
    // 内容行
    'P',
    'Address',
    'Pre',
    'Li',
    'Dt',
    'Dd',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'Figcaption',
    'Summary',
    'Th',
    'Td',
    'Caption',

    // 内联文本容器
    'Audio',
    'Video',
    'Picture',
    'A',
    'Strong',
    'Em',
    'Q',
    'Abbr',
    'Cite',
    'Small',
    'Time',
    'Del',
    'Ins',
    'Sub',
    'Sup',
    'Mark',
    'Code',
    'Orz',
    'Dfn',
    'Samp',
    'Kbd',
    'S',
    'U',
    'Var',
    'Bdo',
    'Meter',
    'B',
    'I',
]
.forEach(function( name ) {
    /**
     * @param  {Element} el 容器元素
     * @param  {Node|[Node]} 合法内容节点（集）
     * @param  {String} meth 插入方法（append|prepend|fill）
     * @return {Element} 容器元素自身
     */
    Content[ name ] = function( el, cons, meth ) {
        return cons && $[meth]( el, cons ), el;
    };
});


//
// 代码插入。
// 结构：[pre, li]/code/..b..
// 会简单检查插入内容的根容器（剥除<code>）。
// 注：内联节点是数据最小单元，因此需检查。
///////////////////////////////////////
[
    'Codeblock',
    'Codeli',
]
.forEach(function( name ) {
    /**
     * @param  {Element} box 代码根容器
     * @param  {Node|[Node]|''} codes 代码内容
     * @param  {String} meth 插入方法
     * @return {Element} 代码根容器元素
     */
    Content[ name ] = function( box, codes, meth ) {
        return insertCodes( box, codes, meth ), box;
    };
});


//
// 注音内容。
// <ruby>的子结构，纯文本内容。
///////////////////////////////////////
[
    'Rb',
    'Rp',
    'Rt',
]
.forEach(function( name ) {
    Content[ name ] = function( el, cons, meth ) {
        return cons && $[meth]( el, $.Text(cons) ), el;
    };
});


//
// 空结构。
// 不支持后期插入内容。
///////////////////////////////////////
[
    'Hr',
    'Space',
    'Track',
    'Source',
    'Meter',
    'Img',
    'Blank',
]
.forEach(function( name ) {
    Content[ name ] = root => root;
});



//
// 工具函数
//////////////////////////////////////////////////////////////////////////////


/**
 * 创建并插入子元素序列。
 * 子元素集插入到上级末尾元素内。
 * 返回值优化：
 * 如果父级只有一个元素，返回该元素本身。否则返回父级存储本身。
 *
 * @param  {[Element]} buf 父级元素存储
 * @param  {[String]} tags 纵向标签序列集
 * @return {Element|[Element]} 父级元素（集）
 */
function elemSubs( buf, tags ) {
    let _last = buf[buf.length - 1];

    for ( const ts of tags) {
        let _els = siblings( ts.trim() );
        _last.append( ..._els );
        _last = _els[_els.length - 1];
    }
    return buf.length > 1 ? buf : buf[0];
}


/**
 * 创建平级兄弟元素序列。
 * @param {String} tags 标签序列
 */
function siblings( tags ) {
    return tags.split(',')
        .map( s => s.trim() )
        .map( n => element(...n.split(':')) );
}


/**
 * 创建目标元素。
 * 若name首字母大写则为内容名称。
 * 角色定义可能为空（忽略）。
 * @param {String} name 内容名或元素标签
 * @param {String} role 角色定义
 */
function element( name, role ) {
    if ( name[0] <= 'Z' ) {
        return create( name );
    }
    return $.Element( name, role && { role } );
}


/**
 * 创建单个元素。
 * 支持角色（role）在标签冒号之后配置。
 * 注：表格元素需要后续参数 rest: {
 * - rows {Number} 行数
 * - cols {Number} 列数
 * - caption {String} 表标题
 * - th0 {Boolean} 是否列表头
 * }
 * @return {Element}
 */
function single( tags, ...rest ) {
    if ( tags == 'table' ) {
        return $.table( ...rest ).elem();
    }
    return element( ...tags.split(':') );
}


/**
 * 设置块容器的标题内容。
 * 如果标题不存在会自动创建并插入容器最前端。
 * 传递内容为null会删除标题元素。
 * @param  {String} tag 标题标签名
 * @param  {Element} box 所属块容器元素
 * @param  {Node|[Node]|''} cons 标题内容
 * @param  {String} meth 插入方法（fill|append|prepend）
 * @return {Element|null} 标题元素
 */
 function blockHeading( tag, box, cons, meth ) {
    let _hx = $.get( `>${tag}`, box );

    if ( cons === null ) {
        return _hx && $.detach(_hx);
    }
    if ( !_hx ) {
        _hx = $.prepend( box, $.Element(tag) );
    }
    return $[meth]( _hx, cons ), _hx;
}


/**
 * 设置片区的标题内容。
 * 如果标题不存在会自动创建并插入关联片区前端。
 * 注：标题内容兼容空串。
 * @param  {String} tag 标题标签名
 * @param  {Element} sect 关联片区元素
 * @param  {Node|[Node]|''} cons 标题内容
 * @param  {String} meth 插入方法（fill|append|prepend）
 * @return {Element} 标题元素
 */
function sectionHeading( tag, sect, cons, meth ) {
    let _hx = $.prev(sect);

    if ( !_hx || !$.is(_hx, tag) ) {
        _hx = $.before( sect, $.Element(tag) );
    }
    return $[meth]( _hx, cons ), _hx;
}


/**
 * 是否为内容件集。
 * 片区有严格的层次结构，因此检查标题情况即可。
 * 注：空集视为内容件集。
 * @param  {[Element]|''} els 子片区集或内容件集
 * @return {Boolean}
 */
function contentItems( els ) {
    return els.length == 0 || !els.some( el => $.is(el, __hxSlr) );
}


/**
 * 添加片区内容。
 * 内容若为片区，外部保证为合法子片区。
 * 内容若为内容件集，则新建片区封装插入。
 * meth: append|prepend|fill
 * @param  {Element} box 片区容器
 * @param  {[Element]|''} cons 子片区或内容件集
 * @param  {String} meth 添加方法
 * @param  {String} sname 新建片区名
 * @param  {Boolean} conItem 内容是否为内容件集
 * @return {Array2} 新插入的片区（标题,片区容器）
 */
function appendSection( box, cons, meth, sname, conItem ) {
    if ( conItem ) {
        let _sx = create(sname);
        cons = Content[sname]( _sx[1], ['', cons], 'append', true );
    }
    return $[meth]( box, cons );
}


/**
 * 设置片区内容。
 * 内容包含子片区集或内容件集（互斥关系）。
 * 原为片区：
 *  - 新片区：简单添加，外部同级保证。
 *  - 内容件：新建一子片区封装插入。
 * 原为内容件：
 *  - 新片区：新建一子片区封装原内容件先行插入。
 *  - 内容件：简单添加（meth）。
 * meth: prepend|append|fill
 * 注：
 * 片区占优（内容可被封装为片区，反之则不行）。
 *
 * @param  {Element} box 片区容器
 * @param  {[Element]|''} cons 子片区集或内容件集
 * @param  {String} meth 插入方法
 * @param  {String} sname 子片区名
 * @param  {Boolean} conItem 内容是否为内容件集
 * @return {[Element]} 新插入的片区或内容件集
 */
function sectionContent( box, cons, meth, sname, conItem ) {
    let _subs = $.children(box);

    if ( !contentItems(_subs) ) {
        return appendSection( box, cons, meth, sname, conItem );
    }
    if ( !conItem ) {
        appendSection( box, _subs, 'append', sname, true );
    }
    return $[meth]( box, cons );
}


/**
 * 创建目录列表（单层）。
 * @param  {Element} ol 列表容器
 * @param  {Element} sec 片区容器
 * @return {Element} ol
 */
function tocList( ol, sec ) {
    let _its = sec.firstElementChild,
        _sec = _its.nextElementSibling;

    while ( _its ) {
        if ( $.is(_its, __hxSlr) ) {
            $.append( ol, tocItem(_its, _sec) );
        }
        _its = _sec.nextElementSibling;
        _sec = _its.nextElementSibling;
    }
    return ol;
}


/**
 * 创建目录列表项（单个）。
 * 如果片区内包含子片区（非纯内容），会递进处理。
 * @param  {Element} hx 标题元素
 * @param  {Element} sect 相邻片区容器
 * @return {Element} 列表项（<li>）
 */
function tocItem( hx, sect ) {
    let _li = null;

    if ( contentItems($.children(sect)) ) {
        _li = Content.Ali( create('Ali'), $.contents(hx) );
    } else {
        _li = Content.Cascadeli( create('Cascadeli'), $.contents(hx) );
        tocList( _li.lastElementChild, sect );
    }
    return _li;
}


/**
 * 检查剥离节点元素的<code>封装。
 * 注：仅检查顶层容器。
 * @param  {Node} node 目标节点
 * @return {Node|[Node]}
 */
function stripCode( node ) {
    if ( node.nodeType != 1 ) {
        return node;
    }
    return $.is(node, 'code') ? $.contents(node) : node;
}


/**
 * 插入代码内容。
 * 固定的<code>友好容错修复。
 * @param  {Element} box 代码容器（<code>父元素）
 * @param  {Node|[Node]|''} codes 代码内容（不含<code>封装）
 * @param  {String} meth 插入方法
 * @return {Node|[Node]} 新插入的节点集
 */
function insertCodes( box, codes, meth ) {
    let _cbox = box.firstElementChild;

    if ( !_cbox ||
        !$.is(_cbox, 'code') ) {
        _cbox = $.wrapInner(box, '<code>');
    }
    if ( codes.nodeType ) {
        codes = stripCode( codes );
    } else {
        codes = $.map( codes, stripCode );
    }
    return $[meth]( _cbox, codes );
}


/**
 * 插入链接内容。
 * 如果容器内不为<a>元素，自动创建封装。
 * @param  {Element} box 链接容器
 * @param  {Node|[Node]} cons 链接内容
 * @param  {String} meth 插入方法
 * @return {Node|[Node]} cons
 */
function insertLink( box, cons, meth ) {
    let _a = $.get( '>a', box );

    if ( !_a ) {
        _a = $.wrapInner( box, '<a>' );
    }
    return $[meth]( _a, cons );
}


/**
 * 列表合并。
 * 源如果是列表容器（ol|ul），只能是单个元素。
 * @param  {Element} to 目标列表
 * @param  {Element|[Element]} src 列表项源（ul|ol|[li]）
 * @param  {String} meth 插入方法
 * @return {[Element]} 新插入的列表项
 */
function listMerge( to, src, meth ) {
    if ( src.nodeType ) {
        src = $.children( src );
    }
    return $[meth]( to, src );
}


/**
 * 小区块内容填充。
 * 指包含标题的小区块单元，内容填充不影响标题本身。
 * 注：标题与内容是同级关系。
 * @param  {Element} root 区块根
 * @param  {Element|[Element]} cons 主体内容集
 * @param  {String} meth 插入方法（prepend|append|fill）
 * @return {Element|null} 标题元素
 */
function insertBlock( root, cons, meth ) {
    let _hx = $.detach(
            $.get(__hxBlock)
        );
    $[meth]( root, cons );

    return _hx && $.prepend( root, _hx );
}


/**
 * 检索/设置表格实例。
 * 效率：缓存解析创建的表格实例。
 * @param  {Element} tbl 表格元素
 * @return {Table}
 */
function tableObj( tbl ) {
    let _tbl = __tablePool.get(tbl);

    if ( !_tbl ) {
        __tablePool.set( tbl, new $.Table(tbl) );
    }
    return _tbl;
}


/**
 * 插入方法对应的位置值。
 * @param  {String} meth 方法名
 * @return {Number}
 */
function tableWhere( meth ) {
    switch (meth) {
        case 'append': return -1;
        case 'prepend': return 0;
    }
    return null;
}


/**
 * 获取表格区实例。
 * @param  {Table} tbl 表格实例
 * @param  {String} name 表格区名称（body|head|foot）
 * @param  {Number} bi tBody元素序号，可选
 * @return {TableSection|null}
 */
function tableSection( tbl, name, bi = 0 ) {
    switch (name) {
        case 'head': return tbl.head();
        case 'foot': return tbl.foot();
        case 'body': return tbl.body()[bi];
    }
    return null;
}


/**
 * 获取表格单元格集。
 * 根据插入方法返回新建或清空的单元格集。
 * meth为填充时会清空rows行的单元格。
 * @param  {Table} tbl 表格实例（$.Table）
 * @param  {String} meth 插入方法
 * @param  {Number} rows 插入行数，可选
 * @param  {String} name 表格区名称（body|head|foot），可选
 * @param  {Number} bi tBody元素序号，可选
 * @return {Collector|null} 单元格集
 */
function tableCells( tbl, meth, rows, name, bi ) {
    let _tsec = tableSection(tbl, name, bi);

    if ( !_tsec && name ) {
        return null;
    }
    if ( meth == 'fill' ) {
        return tbl.gets(0, rows, _tsec).find('th,td').flat().empty().end();
    }
    return tbl[name](tableWhere(meth), rows, _tsec).find('th,td').flat();
}


/**
 * 获取表体元素序号。
 * 约束：实参表体必须在实参表格元素之内。
 * @param  {Table} tbo 表格实例
 * @param  {Element} tbody 表体元素
 * @return {Number}
 */
function tbodyIndex( tbo, tbody ) {
    let _bs = tbo.body();
    return _bs.length == 1 ? 0 : _bs.indexOf(tbody);
}


/**
 * 变通表格行插入方法。
 * meth: before|after|prepend|append
 * @param  {String} meth 方法名
 * @return {String}
 */
function trMeth( meth ) {
    switch (meth) {
        case 'prepend':
            return 'before';
        case 'append':
            return 'after';
    }
    return __trMeths.include(meth) && meth;
}


/**
 * 克隆表格行。
 * 包含表格行上注册的事件处理器。
 * @param  {Element} tr 表格行
 * @param  {Number} rows 目标行数
 * @param  {Boolean} clean 是否清除内容
 * @return {[Element]} 表格行集
 */
function trClone( tr, rows, clean ) {
    let _new = $.clone(tr, true),
        _buf = [_new];

    if ( clean ) {
        $(_new.cells).empty();
    }
    for (let i = 0; i < rows-1; i++) {
        _buf.push( $.clone(_new, true) );
    }
    return _buf;
}


//
// 导出
//////////////////////////////////////////////////////////////////////////////


/**
 * 创建内容结构。
 * 包括非独立逻辑的中间结构。
 * @param  {String} name 内容名称
 * @param  {...Value} 剩余参数（适用table）
 * @return {Element|[Element]} 结构根（序列）
 */
 function create( name, ...rest ) {
    let _tags = tagsMap[name];

    if ( !_tags ) {
        throw new Error(`[${name}] name not found.`);
    }
    if ( __reTag.text(_tags) ) {
        return single( _tags, ...rest );
    }
    _tags = _tags.split('/');

    return elemSubs( siblings(_tags.shift()), _tags );
}


export { create, Article, Content };
