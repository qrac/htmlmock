import { html as beautifyHtml } from "js-beautify"

export type Options = {
  targetSelectors: string[]
  deleteSelectors: string[]
  deleteAttrs: string[]
  absolutePath: string
  convertXlink: boolean
  removeUnusedMeta: boolean
  removeUnusedParams: boolean
  removeUnusedComments: boolean
  indentSize: number
  inlineTags: string[]
}

export const defaultOptions: Options = {
  targetSelectors: [],
  deleteSelectors: ["script", "noscript", "iframe", "style"],
  deleteAttrs: [],
  absolutePath: "",
  convertXlink: true,
  removeUnusedMeta: true,
  removeUnusedParams: true,
  removeUnusedComments: true,
  indentSize: 2,
  inlineTags: ["span", "strong", "b", "small", "del", "s", "code", "br", "wbr"],
}

function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector)
    return true
  } catch {
    return false
  }
}

export function arrayToString(array: string[]) {
  if (array.length === 0) return ""
  return array.join(", ")
}

export function stringToArray(string: string) {
  if (!string) return []
  return string
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isValidSelector(s))
}

export function cleanHtml(html: string, options?: Partial<Options>) {
  const opts: Options = { ...defaultOptions, ...(options || {}) }
  const parser = new DOMParser()

  const hasHtmlTag = /<html[\s>]/i.test(html)
  const hasHeadTag = /<head[\s>]/i.test(html)
  const hasBodyTag = /<body[\s>]/i.test(html)

  let parsedHtml = parser.parseFromString(html, "text/html")

  if (opts.targetSelectors.length > 0) {
    const targetElements = opts.targetSelectors
      .map((selector) => Array.from(parsedHtml.querySelectorAll(selector)))
      .flat()
    if (targetElements.length > 0) {
      const body = parsedHtml.body
      body.innerHTML = ""
      targetElements.forEach((el) => {
        body.appendChild(el.cloneNode(true))
      })
    } else {
      parsedHtml.body.innerHTML = ""
    }
  }

  if (opts.deleteSelectors.length > 0) {
    opts.deleteSelectors.forEach((selector) => {
      const elements = parsedHtml.querySelectorAll(selector)
      elements.forEach((element) => element.remove())
    })
  }

  if (opts.deleteAttrs.length > 0) {
    const selector = opts.deleteAttrs.map((attr) => `[${attr}]`).join(",")
    const elements = parsedHtml.querySelectorAll(selector)
    elements.forEach((element) => {
      opts.deleteAttrs.forEach((attr) => {
        if (element.hasAttribute(attr)) {
          element.removeAttribute(attr)
        }
      })
    })
  }

  if (opts.absolutePath) {
    const updateUrl = (url: string) => {
      return url.startsWith("/") ? opts.absolutePath + url : url
    }
    parsedHtml.querySelectorAll("link[href]").forEach((element) => {
      const href = element.getAttribute("href")
      if (href) {
        element.setAttribute("href", updateUrl(href))
      }
    })
    parsedHtml.querySelectorAll("script[src]").forEach((element) => {
      const src = element.getAttribute("src")
      if (src) {
        element.setAttribute("src", updateUrl(src))
      }
    })
    parsedHtml.querySelectorAll("style").forEach((element) => {
      const cssText = element.textContent
      if (cssText) {
        const updatedCssText = cssText.replace(
          /url\((['"`]?)(\/[^)'"]+)\1\)/g,
          (match, quote, path) => `url(${quote}${updateUrl(path)}${quote})`
        )
        element.textContent = updatedCssText
      }
    })
    parsedHtml.querySelectorAll("[style]").forEach((element) => {
      const styleAttr = element.getAttribute("style")
      if (styleAttr) {
        const updatedStyleAttr = styleAttr.replace(
          /url\((['"`]?)(\/[^)'"]+)\1\)/g,
          (match, quote, path) => `url(${quote}${updateUrl(path)}${quote})`
        )
        element.setAttribute("style", updatedStyleAttr)
      }
    })
    parsedHtml.querySelectorAll("img[src]").forEach((element) => {
      const src = element.getAttribute("src")
      if (src) {
        element.setAttribute("src", updateUrl(src))
      }
    })
    parsedHtml.querySelectorAll("img[srcset]").forEach((element) => {
      const srcset = element.getAttribute("srcset")
      if (srcset) {
        const updatedSrcset = srcset
          .split(",")
          .map((src) => {
            const [path, size] = src.trim().split(/\s+/)
            return `${updateUrl(path)} ${size || ""}`.trim()
          })
          .join(", ")
        element.setAttribute("srcset", updatedSrcset)
      }
    })
    parsedHtml.querySelectorAll("source[srcset]").forEach((element) => {
      const srcset = element.getAttribute("srcset")
      if (srcset) {
        const updatedSrcset = srcset
          .split(",")
          .map((src) => {
            const [path, size] = src.trim().split(/\s+/)
            return `${updateUrl(path)} ${size || ""}`.trim()
          })
          .join(", ")
        element.setAttribute("srcset", updatedSrcset)
      }
    })
  }

  if (opts.convertXlink) {
    const elements = Array.from(
      parsedHtml.getElementsByTagNameNS("http://www.w3.org/2000/svg", "*")
    )
    elements.forEach((element) => {
      const href = element.getAttribute("xlink:href")
      if (href) {
        element.setAttribute("href", href)
        element.removeAttribute("xlink:href")
      }
    })
  }

  if (opts.removeUnusedMeta) {
    const elements = parsedHtml.querySelectorAll(
      `meta:not([charset]):not([name="viewport"])`
    )
    elements.forEach((element) => element.remove())
  }

  if (opts.removeUnusedParams) {
    const elements = parsedHtml.querySelectorAll("[href], [src]")
    elements.forEach((element) => {
      return ["href", "src"].forEach((attr) => {
        const url = element.getAttribute(attr)
        if (url) {
          const cleanedUrl = url.replace(/\?.*?(?=#|$)/, "")
          element.setAttribute(attr, cleanedUrl)
        }
      })
    })
  }

  if (opts.removeUnusedComments) {
    const removeAllComments = (node: Node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.COMMENT_NODE) {
          child.parentNode?.removeChild(child)
        } else if (child.hasChildNodes()) {
          removeAllComments(child)
        }
      })
    }
    removeAllComments(parsedHtml)
  }

  const targetHtml =
    opts.targetSelectors.length > 0
      ? parsedHtml.body.innerHTML
      : hasHtmlTag
      ? parsedHtml.documentElement.outerHTML
      : hasHeadTag
      ? parsedHtml.head.outerHTML
      : hasBodyTag
      ? parsedHtml.body.outerHTML
      : parsedHtml.body.innerHTML

  return beautifyHtml(targetHtml, {
    indent_size: opts.indentSize,
    max_preserve_newlines: 0,
    indent_inner_html: true,
    extra_liners: [],
    inline: opts.inlineTags,
  })
}
