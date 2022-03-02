const api_url = 'https://e.coding.net/open-api';


// 获取用户id
const getUserId = async (ctx, teamName, token) => {
  const response = await  ctx.Request.request({
    method: 'GET',
    url: `https://${teamName}.coding.net/api/me`,
    headers: {
      Authorization: `token ${token}`
    },
    json: true
  });
  return response.id;

};

// 获取项目id
const getProjectId = async (ctx, token, projectName) => {
  const response = await  ctx.Request.request({
    method: 'POST',
    url: `${api_url}?Action=DescribeCodingProjects`,
    headers: {
      Authorization: `token ${token}`
    },
    body: {
      "Action":"DescribeCodingProjects",
      "ProjectName": projectName
    },
    json: true
  });
  return response.Response.Data.ProjectList[0].Id;
};

// 获取仓库id
const getDepotId = async (ctx, token, projectId, depotName) => {
  const response = await  ctx.Request.request({
    method: 'POST',
    url: `${api_url}?Action=DescribeProjectDepotInfoList`,
    headers: {
      Authorization: `token ${token}`
    },
    body: {
      "Action":"DescribeProjectDepotInfoList",
      "ProjectId": projectId
    },
    json: true
  });
  const depots = response.Response.DepotData.Depots;
  for (let i = 0; i < depots.length; i++) {
    if (depots[i].Name === depotName) {
      return depots[i].Id;
    }
  }
};

// 获取仓库最后的sha
const getLastCommitSha = async (ctx, token, depotId, branch) => {
  const response = await  ctx.Request.request({
    method: 'POST',
    url: `${api_url}?Action=DescribeGitCommits`,
    headers: {
      Authorization: `token ${token}`
    },
    body: {
      "Action": "DescribeGitCommits",
      "DepotId": depotId,
      "PageNumber": 1,
      "PageSize": 1,
      "Ref": branch,
      "Path": "",
      "StartDate": "",
      "EndDate": ""
    },
    json: true
  });
  return response.Response.Commits[0].Sha;
};

// 上传文件
const upLoadImgs = async (ctx, userId, token, depotId, lastCommitSha, branch, options) => {
  const response = await  ctx.Request.request({
    method: 'POST',
    url: `${api_url}?Action=CreateBinaryFiles`,
    headers: {
      Authorization: `token ${token}`
    },
    body:{
      "Action": "CreateBinaryFiles",
      "DepotId": depotId,
      "UserId": userId,
      "SrcRef": branch,
      "DestRef": branch,
      "Message": `upload ${options.filesName}`,
      "LastCommitSha": lastCommitSha,
      "GitFiles": options.files
    },
    json: true
  });
  return response.Response.RequestId;
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

    // 获取token
    const token = userConfig.token;

    // 解析group和Project
    const teamNameProjectName = userConfig.teamNameProjectName.split('/');
    const teamName = teamNameProjectName[0];
    const projectName = teamNameProjectName[1];
    // 解析 depot和branch
    const depotNameBranch = userConfig.repoNameBranch.split('/');
    const depotName = depotNameBranch[0];
    const branch = depotNameBranch[1] || 'master';
    // 保存结构确定
    let floder = '';
    let saveWithDate = false;
    const dirStructure = userConfig.dirStructure || '';
    const splitCharIndex = dirStructure.indexOf('/');
    // 判断是否需要保存至文件夹
    if (splitCharIndex !== -1) {
      floder = dirStructure.slice(0, splitCharIndex);
    }
    // 判断是否需要按日期保存
    if (dirStructure.slice(splitCharIndex + 1, dirStructure.length) === ':date') {
      saveWithDate = true;
    }
    // 组装最终path
    let path = '';
    if (floder) {
      if (saveWithDate) {
        const date = new Date();
        path = `${floder}/${date .getFullYear()}/${date .getMonth() + 1}/${date .getDate()}/`;
      } else {
        path = `${floder}/`;
      }
    } else {
      if (saveWithDate) {
        const date = new Date();
        path = `${date .getFullYear()}/${date .getMonth() + 1}/${date .getDate()}/`;
      }
    }
    // 自定义url设置
    // todo: 自定义域名设置找不到了
    let basicUrl = `https://${teamName}.coding.net/p/${projectName}/d/${depotName}/git/raw/${branch}/`;
    if (basicUrl[basicUrl.length - 1] === '/') {
      basicUrl = basicUrl.substr(0, basicUrl.length - 1);
    }

    // 获取项目id
    const projectId = await getProjectId(ctx, token, projectName);
    // 获取仓库id
    const depotId = await getDepotId(ctx, token, projectId, depotName);
    // 获取最后一次sha
    const lastCommitSha = await getLastCommitSha(ctx, token, depotId, branch);
    // 获取用户id
    const userId = await getUserId(ctx, teamName, token);
    try {
      const imgList = ctx.output;
      const files = [];
      let filesName = '';
      for (const i in imgList) {
        const image = imgList[i].buffer;
        const fileName = imgList[i].fileName.replace(/\s/g, '');
        files.push({
          "Path": `${path}${fileName}`,
          "Content": image.toString("base64"),
          "NewPath": ""
        });
        filesName += `${fileName}  `;
      }
      await upLoadImgs(ctx, userId, token, depotId, lastCommitSha, branch, {files, filesName});
      for (const i in imgList) {
        const fileName = imgList[i].fileName.replace(/\s/g, '');
        delete imgList[i].base64Image;
        delete imgList[i].buffer;
        imgList[i].imgUrl = `${basicUrl}/${path}${fileName}`;
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
        name: 'teamNameProjectName',
        type: 'input',
        default: userConfig.teamNameProjectName,
        required: true,
        message: 'teamNameProjectName',
        alias: '团队名称/项目名称'
      },
      {
        name: 'token',
        type: 'input',
        default: userConfig.token,
        required: true,
        message: 'token',
        alias: '个人token'
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
      }
    ];
  };
  return {
    uploader: 'coding',
    register
  };
};
