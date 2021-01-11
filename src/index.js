const puppeteer = require('puppeteer');

const postOptions = (realUrl, lastCommit, cookies, fileName, image, XSRF_TOKEN) => {
  const formData = {
    message: `upload ${fileName}`,
    lastCommitSha: lastCommit,
    newRef: '',
    uploadFile: {
      value: image,
      options: {
        filename: fileName
      }
    }

  };
  return {
    method: 'POST',
    url: realUrl,
    headers: {
      contentType: 'multipart/form-data',
      'User-Agent': 'PicGo',
      Cookie: cookies,
      'X-XSRF-TOKEN': XSRF_TOKEN
    },
    formData: formData
  };
};

const getCookies = async (groupName, account, password) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page._client.send('Network.clearBrowserCookies');
  await page.goto(`https://${groupName}.coding.net/login`,  {waitUntil: 'networkidle0'});
  await page.content();
  await page.type("#account", account);
  await page.type("#password", password);
  await page.click("#login > div > div.auth-root-3ssdaLNMpv > main > div.form-container-1lsWy1AThz > form > div.form-content-32QJSI8qUW > div.info-login-3niBdtBCEI > label > div > span > input");
  await page.click("#login > div > div.auth-root-3ssdaLNMpv > main > div.form-container-1lsWy1AThz > form > div.form-button-group-1pG0raRyP0 > button");
  await page.waitForNavigation();
  const cookies_kv = await page.cookies();
  await browser.close();
  let cookies = '';
  let XSRF_TOKEN = '';
  cookies_kv.forEach(function (item) {
    cookies += `${item.name}=${item.value};`;
    if (item.name === 'XSRF-TOKEN') {
      XSRF_TOKEN = item.value;
    }
  });
  return {cookies, XSRF_TOKEN};
};

module.exports = (ctx) => {
  const register = () => {
    ctx.helper.uploader.register('coding', {
      handle,
      name: 'Coding图床',
      config: config
    });
  };

  const handle = async function (ctx) {
    const userConfig = ctx.getConfig('picBed.coding');
    if (!userConfig) {
      throw new Error("Can't find uploader config");
    }

    // 解析group Projetc
    const groupNameProject = userConfig.groupNameProject.split('/');
    const groupName = groupNameProject[0];
    const project = groupNameProject[1];
    // 解析 repo branch
    const repoNameBranch = userConfig.repoNameBranch.split('/');
    const repoName = repoNameBranch[0];
    const branch = repoNameBranch[1] || 'master';
    // 保存结构确定
    let floder = '';
    let saveWithDate = false;
    const dirStructure = userConfig.dirStructure || '';
    const splitChar = dirStructure.indexOf('/');
    if (splitChar !== -1) {
      floder = dirStructure.slice(0, splitChar);
    }
    if (dirStructure.slice(splitChar + 1, dirStructure.length) === ':date') {
      saveWithDate = true;
    }
    const account = userConfig.account;
    const password = userConfig.passwd;
    const {cookies, XSRF_TOKEN} = await getCookies(groupName, account, password);
    let basicUrl = userConfig.customUrl || `https://${groupName}.coding.net/p/${project}/d/${repoName}/git/raw/${branch}`;
    if (basicUrl[basicUrl.length - 1] === '/') {
      basicUrl = basicUrl.substr(0, basicUrl.length - 2);
    }
    let suffixUrl = '';
    const preUrl = `https://${groupName}.coding.net/api/user/${groupName}/project/${project}/depot/${repoName}/git/upload/${branch}`;
    if (floder) {
      if (saveWithDate) {
        const date = new Date();
        suffixUrl = `${floder}/${date .getFullYear()}/${date .getMonth() + 1}/${date .getDate()}`;
      } else {
        suffixUrl = `${floder}`;
      }
    } else {
      if (saveWithDate) {
        const date = new Date();
        suffixUrl = `${date .getFullYear()}/${date .getMonth() + 1}/${date .getDate()}`;
      }
    }
    let realUrl = '';
    if (suffixUrl.length !== 0) {
      realUrl = `${preUrl}/${suffixUrl}`;
    } else {
      realUrl = `${preUrl}`;
    }
    try {
      const imgList = ctx.output;
      for (const i in imgList) {
        let lastCommit = '';
        // eslint-disable-next-line no-await-in-loop
        const rep = await ctx.Request.request({
          method: 'GET',
          url: `https://${groupName}.coding.net/api/user/${groupName}/project/${project}/depot/${repoName}/git/tree/${branch}`,
          headers: {
            Cookie: cookies
          }
        });
        lastCommit = JSON.parse(rep).data.lastCommit.commitId;
        let image = imgList[i].buffer;
        if (!image && imgList[i].base64Image) {
          image = Buffer.from(imgList[i].base64Image, 'base64');
        }

        const fileName = imgList[i].fileName.replace(/\s/g, '');
        const postConfig = postOptions(
            realUrl,
            lastCommit,
            cookies,
            fileName,
            image,
            XSRF_TOKEN
        );
        // eslint-disable-next-line no-await-in-loop
        const data = await ctx.Request.request(postConfig);
        ctx.log.info(JSON.parse(data));
        delete imgList[i].buffer;
        // imgList[i].imgUrl = `https://${groupName}.coding.net/p/${project}/d/${project}/git/raw/${branch}/${fileName}`;
        if (JSON.parse(data).code === 0) {
          if (suffixUrl.length === 0) {
            imgList[i].imgUrl = `${basicUrl}/${fileName}`;
          } else {
            imgList[i].imgUrl = `${basicUrl}/${suffixUrl}/${fileName}`;
          }

        }
      }
    } catch (err) {
      ctx.emit('notification', {
        title: '上传失败',
        body: JSON.stringify(err)
      });
    }
  };

  const config = (ctx) => {
    let userConfig = ctx.getConfig('picBed.coding');
    if (!userConfig) {
      userConfig = {};
    }
    return [
      {
        name: 'groupNameProject',
        type: 'input',
        default: userConfig.groupNameProject,
        required: true,
        message: 'groupNameProject',
        alias: '团队名称/项目名称'
      },
      {
        name: 'account',
        type: 'input',
        default: userConfig.account,
        required: true,
        message: 'account',
        alias: '登录手机号或邮箱'
      },
      {
        name: 'passwd',
        type: 'password',
        default: userConfig.passwd,
        required: true,
        message: 'passwd',
        alias: '密码'
      },
      {
        name: 'repoNameBranch',
        type: 'input',
        default: userConfig.repoNameBranch,
        required: true,
        message: '可只填仓库名称',
        alias: '仓库名称/分支'
      },

      {
        name: 'dirStructure',
        type: 'input',
        default: userConfig.dirStructure,
        required: false,
        message: '默认为存放在根目录。floder/:date | floder | :date。floder为自定义文件夹名',
        alias: '存储结构'
      },
      {
        name: 'customUrl',
        type: 'input',
        required: false,
        default: userConfig.customUrl,
        alias: '自定义域名'
      }
    ];
  };
  return {
    uploader: 'coding',
    register
  };
};
